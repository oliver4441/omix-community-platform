/**
 * Notification center — creation, delivery, and per-channel override routes.
 *
 * Notifications are rows in the `notifications` table (delivery via push/FCM is
 * orthogonal and routed through the existing /notifications/queue endpoint).
 */
import type { Env } from "./env";
import { json, readJson, now, genId, parseJson } from "./util";
import type { SessionUser } from "./util";

export type NotificationType =
  | "mention"
  | "reply"
  | "dm"
  | "reaction"
  | "invite"
  | "call"
  | "event"
  | "moderation"
  | "system";

export interface CreateNotification {
  targetUserId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Free-form payload (channelId, serverId, messageId…). */
  data?: Record<string, string>;
}

const MAX_ALERT_LEN = 300;

export async function createNotification(
  env: Env,
  n: CreateNotification
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO notifications (id, target_user_id, title, body, data, sent, read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
    )
      .bind(
        genId(),
        n.targetUserId,
        n.title.slice(0, MAX_ALERT_LEN),
        (n.body || "").slice(0, MAX_ALERT_LEN),
        JSON.stringify({ type: n.type, ...(n.data || {}) }),
        now()
      )
      .run();
  } catch (err) {
    console.error("[notifications] create failed:", err);
  }
}

/** Resolve up to N user ids by display name (users.full_name or profiles.name). */
export async function resolveUsersByName(
  env: Env,
  names: string[],
  max = 10
): Promise<string[]> {
  const ids = new Set<string>();
  for (const name of names.slice(0, max)) {
    if (!name || name.length > 80) continue;
    const rows = await env.DB.prepare(
      `SELECT id FROM users WHERE full_name = ? UNION
       SELECT session_id AS id FROM profiles WHERE name = ?`
    )
      .bind(name, name)
      .all<{ id: string }>();
    for (const row of rows.results || []) ids.add(row.id);
    if (ids.size >= max) break;
  }
  return [...ids];
}

function mapNotification(row: Record<string, unknown>) {
  return {
    id: row.id,
    type: parseJson<Record<string, unknown>>(row.data as string, {}).type || "system",
    title: row.title,
    body: row.body,
    data: parseJson<Record<string, unknown>>(row.data as string, {}),
    read: Boolean(row.read),
    createdAt: row.created_at,
  };
}

export async function handleNotifications(
  env: Env,
  request: Request,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  if (p === "/notifications" && method === "GET") {
    const unreadOnly = url.searchParams.get("unread") === "1";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
    const sql = unreadOnly
      ? "SELECT * FROM notifications WHERE target_user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT ?"
      : "SELECT * FROM notifications WHERE target_user_id = ? ORDER BY created_at DESC LIMIT ?";
    const { results } = await env.DB.prepare(sql)
      .bind(user.id, limit)
      .all<Record<string, unknown>>();
    return json((results || []).map(mapNotification), 200, env);
  }

  if (p === "/notifications/unread-count" && method === "GET") {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM notifications WHERE target_user_id = ? AND read = 0"
    )
      .bind(user.id)
      .first<{ c: number }>();
    return json({ count: row?.c || 0 }, 200, env);
  }

  if (p === "/notifications/read-all" && method === "POST") {
    await env.DB.prepare("UPDATE notifications SET read = 1 WHERE target_user_id = ?")
      .bind(user.id)
      .run();
    return json({ ok: true }, 200, env);
  }

  const readMatch = p.match(/^\/notifications\/([^/]+)\/read$/);
  if (readMatch && method === "POST") {
    await env.DB.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND target_user_id = ?")
      .bind(readMatch[1], user.id)
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Per-channel/thread notification overrides ──
  if (p === "/notification-overrides" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM notification_overrides WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(user.id)
      .all<Record<string, unknown>>();
    return json(
      (results || []).map((r) => ({
        id: r.id,
        scope: r.scope,
        targetId: r.target_id,
        level: r.level,
      })),
      200,
      env
    );
  }

  if (p === "/notification-overrides" && method === "PUT") {
    const body = await readJson<{
      scope?: string;
      targetId?: string;
      level?: string;
    }>(request);
    const scope = body.scope === "thread" ? "thread" : "channel";
    const level = ["all", "mentions", "muted"].includes(body.level || "")
      ? body.level
      : "default";
    if (!body.targetId) return json({ error: "targetId_required" }, 400, env);
    await env.DB.prepare(
      `INSERT INTO notification_overrides (id, user_id, scope, target_id, level, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, scope, target_id) DO UPDATE SET level = excluded.level`
    )
      .bind(genId(), user.id, scope, body.targetId, level, now())
      .run();
    return json({ ok: true }, 200, env);
  }

  const overrideDelete = p.match(/^\/notification-overrides\/([^/]+)$/);
  if (overrideDelete && method === "DELETE") {
    await env.DB.prepare("DELETE FROM notification_overrides WHERE id = ? AND user_id = ?")
      .bind(overrideDelete[1], user.id)
      .run();
    return json({ ok: true }, 200, env);
  }

  return null;
}

/**
 * Effective notification level for a channel (defaults to "default").
 * Shared with crud so message ingestion can skip muted channels.
 */
export async function getChannelNotificationLevel(
  env: Env,
  userId: string,
  channelId: string
): Promise<"default" | "all" | "mentions" | "muted"> {
  const row = await env.DB.prepare(
    "SELECT level FROM notification_overrides WHERE user_id = ? AND scope = 'channel' AND target_id = ?"
  )
    .bind(userId, channelId)
    .first<{ level: string }>();
  return (row?.level as "default" | "all" | "mentions" | "muted") || "default";
}
