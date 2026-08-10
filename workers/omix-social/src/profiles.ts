/**
 * profiles — user profiles, stats/XP and presence.
 *
 * Extracted from the former crud.ts monolith.
 */
import type { Env } from "../../shared/env";
import {
  json,
  readJson,
  now,
  genId,
  parseJson,
  stringifyJson,
  type SessionUser,
} from "../../shared/util";

// ═══════════ mappers ═══════════

function mapPresence(r: Record<string, unknown>) {
  return {
    id: r.session_id,
    name: r.display_name,
    color: r.color,
    online: Boolean(r.online),
    status: (r.status as string) || "online",
    statusText: (r.status_text as string) || "",
  };
}

function mapStats(r: Record<string, unknown>) {
  return {
    xp: (r.xp as number) || 0,
    level: (r.level as number) || 1,
    messagesSent: (r.messages_sent as number) || 0,
    reactionsReceived: (r.reactions_received as number) || 0,
    repliesReceived: (r.replies_received as number) || 0,
    badges: parseJson<string[]>(r.badges as string, []),
    lastMessageDate: (r.last_message_date as string) || "",
    joinDate: (r.join_date as string) || "",
    streakCount: (r.streak_count as number) || 0,
  };
}

// ═══════════ helpers ═══════════

function computeBadges(s: { xp: number; messagesSent: number; reactionsReceived: number; repliesReceived: number; streakCount: number }): string[] {
  const badges: string[] = [];
  if (s.messagesSent >= 1) badges.push("first_message");
  if (s.messagesSent >= 100) badges.push("chatter");
  if (s.reactionsReceived >= 10) badges.push("popular");
  if (s.repliesReceived >= 10) badges.push("helper");
  if (s.xp > 0 && Math.floor(Math.sqrt(s.xp / 100)) + 1 >= 10) badges.push("veteran");
  if (s.streakCount >= 3) badges.push("streak_3");
  return badges;
}

// ═══════════ handler ═══════════

export async function handleProfiles(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  // ── Presence ──
  if (p === "/presence" && method === "POST") {
    const { displayName, color } = await readJson<{ displayName?: string; color?: string }>(request);
    await env.DB.prepare(
      `INSERT INTO presence (id, session_id, display_name, color, online, last_seen, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET display_name = excluded.display_name,
         color = excluded.color, online = 1, last_seen = excluded.last_seen`
    )
      .bind(genId(), user.id, displayName || user.fullName, color || "#8B5CF6", now(), now())
      .run();
    return json({ ok: true }, 200, env);
  }
  if (p === "/presence" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM presence WHERE online = 1 ORDER BY display_name"
    ).all<Record<string, unknown>>();
    return json((results || []).map(mapPresence), 200, env);
  }
  if (p === "/me/status" && method === "PUT") {
    const body = await readJson<{ status?: string; statusText?: string }>(request);
    const status = ["online", "idle", "dnd", "offline"].includes(body.status || "")
      ? (body.status as string)
      : "online";
    const statusText = (body.statusText || "").trim().slice(0, 64);
    await env.DB.prepare(
      `INSERT INTO presence (id, session_id, display_name, color, online, status, status_text, last_seen, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET status = excluded.status,
         status_text = excluded.status_text, online = 1, last_seen = excluded.last_seen`
    )
      .bind(
        genId(),
        user.id,
        user.fullName,
        "#8B5CF6",
        status,
        statusText,
        now(),
        now()
      )
      .run();
    return json({ ok: true, status, statusText }, 200, env);
  }

  // ── Profiles ──
  const profileMatch = p.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch && method === "GET") {
    const row = await env.DB.prepare(
      `SELECT pr.*, p.status, p.status_text FROM profiles pr
       LEFT JOIN presence p ON p.session_id = pr.session_id
       WHERE pr.session_id = ?`
    )
      .bind(profileMatch[1])
      .first<Record<string, unknown>>();
    if (!row) return json(null, 200, env);
    return json(
      {
        name: row.name,
        avatar: (row.avatar as string) || "",
        color: row.color,
        githubUsername: (row.github_username as string) || "",
        bio: (row.bio as string) || "",
        title: (row.title as string) || "",
        skills: parseJson<string[]>((row.skills as string) || "[]", []),
        status: (row.status as string) || "offline",
        statusText: (row.status_text as string) || "",
      },
      200,
      env
    );
  }
  if (p === "/profiles" && method === "PUT") {
    const body = await readJson<{
      name?: string;
      avatar?: string;
      color?: string;
      githubUsername?: string;
      bio?: string;
      title?: string;
      skills?: string[];
    }>(request);
    const ts = now();
    const name = (body.name || user.fullName || "").trim();
    const skills = Array.isArray(body.skills) ? body.skills.slice(0, 20) : [];
    await env.DB.prepare(
      `INSERT INTO profiles (id, session_id, name, avatar, color, github_username, bio, title, skills, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar,
         color = excluded.color, github_username = excluded.github_username, bio = excluded.bio,
         title = excluded.title, skills = excluded.skills, updated_at = excluded.updated_at`
    )
      .bind(
        genId(),
        user.id,
        name,
        body.avatar || "",
        body.color || "#8B5CF6",
        body.githubUsername || "",
        body.bio || "",
        body.title || "",
        JSON.stringify(skills),
        ts,
        ts
      )
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Stats ──
  const statsMatch = p.match(/^\/stats\/([^/]+)$/);
  if (statsMatch && method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM stats WHERE session_id = ?")
      .bind(statsMatch[1])
      .first<Record<string, unknown>>();
    if (!row) {
      return json(
        { xp: 0, level: 1, messagesSent: 0, reactionsReceived: 0, repliesReceived: 0, badges: [], joinDate: now().split("T")[0], lastMessageDate: "", streakCount: 0 },
        200,
        env
      );
    }
    return json(mapStats(row), 200, env);
  }
  if (p === "/stats/xp" && method === "POST") {
    const { amount, reason } = await readJson<{ amount?: number; reason?: string }>(request);
    const uid = user.id;
    const today = now().split("T")[0];
    let row = await env.DB.prepare("SELECT * FROM stats WHERE session_id = ?").bind(uid).first<Record<string, unknown>>();
    const ts = now();
    if (!row) {
      await env.DB.prepare(
        `INSERT INTO stats (id, session_id, xp, level, messages_sent, reactions_received, replies_received, badges, last_message_date, streak_count, join_date, created_at, updated_at)
         VALUES (?, ?, 0, 1, 0, 0, 0, '[]', '', 0, ?, ?, ?)`
      )
        .bind(genId(), uid, today, ts, ts)
        .run();
      row = await env.DB.prepare("SELECT * FROM stats WHERE session_id = ?").bind(uid).first<Record<string, unknown>>();
    }
    if (!row) return json({ error: "internal" }, 500, env);
    const amt = amount || 0;
    const newXp = ((row.xp as number) || 0) + amt;
    const level = Math.floor(Math.sqrt(newXp / 100)) + 1;
    let streak = (row.streak_count as number) || 0;
    let msgs = (row.messages_sent as number) || 0;
    let reacts = (row.reactions_received as number) || 0;
    let replies = (row.replies_received as number) || 0;
    if (reason === "message") {
      msgs += 1;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      streak = (row.last_message_date as string) === yesterday ? streak + 1 : (row.last_message_date as string) === today ? streak : 1;
    }
    if (reason === "reaction") reacts += 1;
    if (reason === "reply") replies += 1;
    const badges = computeBadges({ xp: newXp, messagesSent: msgs, reactionsReceived: reacts, repliesReceived: replies, streakCount: streak });
    await env.DB.prepare(
      `UPDATE stats SET xp = ?, level = ?, messages_sent = ?, reactions_received = ?,
              replies_received = ?, badges = ?, last_message_date = ?, streak_count = ?, updated_at = ?
       WHERE session_id = ?`
    )
      .bind(newXp, level, msgs, reacts, replies, stringifyJson(badges), today, streak, ts, uid)
      .run();
    return json({ ok: true, xp: newXp, level, badges }, 200, env);
  }

  return null;
}
