/**
 * Moderation — reports, moderation queue, member actions, audit log.
 *
 * All destructive actions are gated by capability checks (see permissions.ts)
 * and are appended to the audit log. Mutes/timeouts expire server-side: a
 * membership with muted_until in the future cannot send messages.
 */
import type { Env } from "./env";
import { json, readJson, now, genId } from "./util";
import type { SessionUser } from "./util";
import {
  hasCapability,
  canModerate,
  normalizeRole,
  type ServerRole,
} from "./permissions";
import { moderationRateLimit } from "./ratelimit";
import { createNotification } from "./notifications";

export interface MemberRow {
  id: string;
  server_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  last_read_at: string;
  muted_until: string | null;
  banned: number;
}

export async function getMembership(
  env: Env,
  serverId: string,
  userId: string
): Promise<MemberRow | null> {
  return (
    (await env.DB.prepare(
      "SELECT * FROM server_members WHERE server_id = ? AND user_id = ?"
    )
      .bind(serverId, userId)
      .first<Record<string, unknown>>()) as unknown as MemberRow | null
  ) || null;
}

export async function requireMembership(
  env: Env,
  serverId: string,
  userId: string
): Promise<MemberRow | null> {
  const member = await getMembership(env, serverId, userId);
  if (!member || member.banned) return null;
  return member;
}

export async function memberCapabilities(
  env: Env,
  member: MemberRow,
  channelId?: string
) {
  const role = normalizeRole(member.role);
  let overrides: { scope: "role" | "member"; scopeId: string; allow: string[]; deny: string[] }[] = [];
  if (channelId) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM channel_permission_overrides WHERE channel_id = ?"
    )
      .bind(channelId)
      .all<Record<string, unknown>>();
    overrides = (results || []).map((r) => ({
      scope: r.scope as "role" | "member",
      scopeId: (r.scope_id as string) || "",
      allow: JSON.parse((r.allow as string) || "[]"),
      deny: JSON.parse((r.deny as string) || "[]"),
    }));
  }
  return { role, overrides };
}

export function can(
  env: Env,
  member: MemberRow,
  capability: Parameters<typeof hasCapability>[1],
  overrides: Parameters<typeof hasCapability>[2] = []
): boolean {
  return hasCapability(normalizeRole(member.role), capability, overrides);
}

async function writeAudit(
  env: Env,
  entry: {
    serverId: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType?: string;
    targetId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (id, server_id, actor_id, actor_name, action, target_type, target_id, reason, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        genId(),
        entry.serverId,
        entry.actorId,
        entry.actorName,
        entry.action,
        entry.targetType || "",
        entry.targetId || "",
        entry.reason || "",
        JSON.stringify(entry.metadata || {}),
        now()
      )
      .run();
  } catch (err) {
    console.error("[moderation] audit write failed:", err);
  }
}

export async function logAudit(
  env: Env,
  entry: Parameters<typeof writeAudit>[1]
): Promise<void> {
  await writeAudit(env, entry);
}

const MOD_ACTIONS = ["warn", "mute", "unmute", "timeout", "kick", "ban", "unban"] as const;
type ModAction = (typeof MOD_ACTIONS)[number];

export async function handleModeration(
  env: Env,
  request: Request,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  // ── Member directory ──
  const membersMatch = p.match(/^\/servers\/([^/]+)\/members$/);
  if (membersMatch && method === "GET") {
    const member = await requireMembership(env, membersMatch[1], user.id);
    if (!member) return json({ error: "not_a_member" }, 403, env);
    const { results } = await env.DB.prepare(
      `SELECT sm.*, u.full_name, u.avatar_url
       FROM server_members sm LEFT JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = ? AND sm.banned = 0 ORDER BY sm.joined_at ASC`
    )
      .bind(membersMatch[1])
      .all<Record<string, unknown>>();
    return json(
      (results || []).map((r) => ({
        userId: r.user_id,
        name: (r.full_name as string) || "Unknown",
        avatar: (r.avatar_url as string) || "",
        role: normalizeRole(r.role),
        joinedAt: r.joined_at,
        mutedUntil: (r.muted_until as string) || null,
      })),
      200,
      env
    );
  }

  // ── Reports ──
  const reportsMatch = p.match(/^\/servers\/([^/]+)\/reports$/);
  if (reportsMatch && method === "POST") {
    const member = await requireMembership(env, reportsMatch[1], user.id);
    if (!member) return json({ error: "not_a_member" }, 403, env);
    const body = await readJson<{
      targetType?: string;
      targetId?: string;
      reason?: string;
    }>(request);
    const targetType = ["message", "user", "thread"].includes(body.targetType || "")
      ? body.targetType
      : "message";
    if (!body.targetId) return json({ error: "targetId_required" }, 400, env);
    const reason = (body.reason || "").slice(0, 500);
    await env.DB.prepare(
      `INSERT INTO reports (id, server_id, reporter_id, target_type, target_id, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    )
      .bind(genId(), reportsMatch[1], user.id, targetType, body.targetId, reason, now())
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Moderation queue (reports + recent actions) ──
  if (p === "/moderation/queue" && method === "GET") {
    // Only staff of at least one community (or platform admin) may read the queue.
    if (!user.isAdmin) {
      const { results: memberships } = await env.DB.prepare(
        "SELECT role FROM server_members WHERE user_id = ? AND banned = 0"
      )
        .bind(user.id)
        .all<{ role: string }>();
      const isStaff = (memberships || []).some((m) => {
        const role = normalizeRole(m.role);
        return hasCapability(role, "MANAGE_MODERATION");
      });
      if (!isStaff) return json({ error: "forbidden" }, 403, env);
    }
    const { results: reports } = await env.DB.prepare(
      `SELECT * FROM reports WHERE status = 'open' ORDER BY created_at DESC LIMIT 100`
    ).all<Record<string, unknown>>();
    const { results: actions } = await env.DB.prepare(
      "SELECT * FROM moderation_actions ORDER BY created_at DESC LIMIT 50"
    ).all<Record<string, unknown>>();
    return json(
      {
        reports: (reports || []).map((r) => ({
          id: r.id,
          serverId: r.server_id,
          reporterId: r.reporter_id,
          targetType: r.target_type,
          targetId: r.target_id,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
        })),
        recentActions: (actions || []).map((a) => ({
          id: a.id,
          serverId: a.server_id,
          actorId: a.actor_id,
          targetUserId: a.target_user_id,
          action: a.action,
          reason: a.reason,
          expiresAt: (a.expires_at as string) || null,
          createdAt: a.created_at,
        })),
      },
      200,
      env
    );
  }

  const reportResolve = p.match(/^\/reports\/([^/]+)$/);
  if (reportResolve && method === "PATCH") {
    const body = await readJson<{ status?: string }>(request);
    if (!["resolved", "dismissed"].includes(body.status || ""))
      return json({ error: "invalid_status" }, 400, env);
    const row = await env.DB.prepare("SELECT * FROM reports WHERE id = ?")
      .bind(reportResolve[1])
      .first<Record<string, unknown>>();
    if (!row) return json({ error: "not_found" }, 404, env);
    const member = await requireMembership(env, row.server_id as string, user.id);
    if (!member || !can(env, member, "MANAGE_MODERATION"))
      return json({ error: "forbidden" }, 403, env);
    await env.DB.prepare("UPDATE reports SET status = ?, handled_by = ? WHERE id = ?")
      .bind(body.status, user.id, reportResolve[1])
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Moderation actions: warn / mute / unmute / timeout / kick / ban / unban ──
  const actionMatch = p.match(/^\/servers\/([^/]+)\/moderation\/([^/]+)$/);
  if (actionMatch && method === "POST") {
    const serverId = actionMatch[1];
    const targetUserId = actionMatch[2];
    const body = await readJson<{ action?: string; reason?: string; durationMinutes?: number }>(request);
    const action = body.action as ModAction;
    if (!MOD_ACTIONS.includes(action)) return json({ error: "invalid_action" }, 400, env);
    if (targetUserId === user.id) return json({ error: "cannot_self_moderate" }, 400, env);

    const actor = await requireMembership(env, serverId, user.id);
    if (!actor) return json({ error: "not_a_member" }, 403, env);

    const { role: actorRole } = await memberCapabilities(env, actor);
    const target = await getMembership(env, serverId, targetUserId);
    if (!target) return json({ error: "target_not_member" }, 404, env);
    const targetRole = normalizeRole(target.role);

    const needsCap =
      action === "kick" ? "KICK_MEMBERS"
      : action === "ban" || action === "unban" ? "BAN_MEMBERS"
      : action === "timeout" || action === "mute" || action === "unmute" ? "TIMEOUT_MEMBERS"
      : "MANAGE_MODERATION";
    if (!hasCapability(actorRole, needsCap) || !canModerate(actorRole, targetRole)) {
      return json({ error: "forbidden" }, 403, env);
    }

    const rl = await moderationRateLimit(env, user.id);
    if (!rl.ok) return json({ error: "rate_limited", retryAfter: rl.retryAfterSeconds }, 429, env);

    const reason = (body.reason || "").slice(0, 300);
    const duration = Math.min(Math.max(body.durationMinutes || 60, 1), 60 * 24 * 28);
    const ts = now();
    const expiresAt =
      action === "mute" || action === "timeout"
        ? new Date(Date.now() + duration * 60_000).toISOString()
        : null;

    if (action === "kick") {
      await env.DB.prepare("DELETE FROM server_members WHERE id = ?").bind(target.id).run();
    } else if (action === "ban") {
      await env.DB.batch([
        env.DB.prepare("UPDATE server_members SET banned = 1 WHERE id = ?").bind(target.id),
        env.DB.prepare("DELETE FROM invites WHERE created_by = ? AND server_id = ?").bind(targetUserId, serverId),
      ]);
    } else if (action === "unban") {
      await env.DB.prepare("UPDATE server_members SET banned = 0 WHERE id = ?").bind(target.id).run();
    } else if (action === "mute" || action === "timeout") {
      await env.DB.prepare("UPDATE server_members SET muted_until = ? WHERE id = ?")
        .bind(expiresAt, target.id)
        .run();
    } else if (action === "unmute") {
      await env.DB.prepare("UPDATE server_members SET muted_until = NULL WHERE id = ?")
        .bind(target.id)
        .run();
    }

    await env.DB.prepare(
      `INSERT INTO moderation_actions (id, server_id, actor_id, target_user_id, action, reason, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(genId(), serverId, user.id, targetUserId, action, reason, expiresAt, ts)
      .run();

    await writeAudit(env, {
      serverId,
      actorId: user.id,
      actorName: user.fullName,
      action: `member_${action}`,
      targetType: "user",
      targetId: targetUserId,
      reason,
      metadata: { durationMinutes: body.durationMinutes || null },
    });

    const actionNames: Record<ModAction, string> = {
      warn: "You received a warning",
      mute: "You were muted",
      unmute: "You were unmuted",
      timeout: "You were timed out",
      kick: "You were removed",
      ban: "You were banned",
      unban: "You were unbanned",
    };
    await createNotification(env, {
      targetUserId,
      type: "moderation",
      title: actionNames[action],
      body: reason ? `Reason: ${reason}` : undefined,
      data: { serverId },
    });

    return json({ ok: true }, 200, env);
  }

  // ── Audit log (read) ──
  const auditMatch = p.match(/^\/servers\/([^/]+)\/audit-log$/);
  if (auditMatch && method === "GET") {
    const member = await requireMembership(env, auditMatch[1], user.id);
    if (!member || !can(env, member, "VIEW_AUDIT_LOG"))
      return json({ error: "forbidden" }, 403, env);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
    const { results } = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE server_id = ? ORDER BY created_at DESC LIMIT ?"
    )
      .bind(auditMatch[1], limit)
      .all<Record<string, unknown>>();
    return json(
      (results || []).map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorName: r.actor_name,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        metadata: JSON.parse((r.metadata as string) || "{}"),
        createdAt: r.created_at,
      })),
      200,
      env
    );
  }

  return null;
}

/** True when the membership is currently muted (mute or timeout in effect). */
export function isMuted(member: MemberRow): boolean {
  if (!member.muted_until) return false;
  return new Date(member.muted_until).getTime() > Date.now();
}

export { MOD_ACTIONS };
export type { ModAction };
