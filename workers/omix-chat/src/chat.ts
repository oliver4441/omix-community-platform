/**
 * chat — messages, threads, pins, reactions, DM channels and typing.
 *
 * Extracted from the former crud.ts monolith. Handles both channel messages
 * and DM messages (they share one schema now — see migration 0006).
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
import {
  queueNotification,
  hasPushSubscriptions,
} from "../../shared/push";

// ═══════════ mappers ═══════════

function mapMessage(r: Record<string, unknown>) {
  return {
    id: r.id,
    channelId: (r.channel_id as string) || (r.dm_channel_id as string) || "",
    author: (r.author as string) || "Anonymous",
    authorId: (r.author_id as string) || "",
    sessionId: (r.session_id as string) || "",
    text: (r.text as string) || "",
    color: (r.color as string) || "#8B5CF6",
    timestamp: r.timestamp,
    reactions: parseJson<Record<string, string[]>>(r.reactions as string, {}),
    edited: Boolean(r.edited),
    editedAt: (r.edited_at as string) || undefined,
    pinned: Boolean(r.pinned),
    pinnedAt: (r.pinned_at as string) || undefined,
    fileUrl: (r.file_url as string) || undefined,
    fileType: (r.file_type as string) || undefined,
    fileName: (r.file_name as string) || undefined,
    fileSize: (r.file_size as number) || undefined,
    replyTo: parseJson<unknown>(r.reply_to as string, undefined),
    threadId: (r.thread_id as string) || undefined,
    mentions: parseJson<unknown>(r.mentions as string, undefined),
  };
}

function mapDM(r: Record<string, unknown>) {
  return {
    id: r.id,
    participants: parseJson<string[]>(r.participants as string, []),
    participantNames: parseJson<Record<string, string>>(r.participant_names as string, {}),
    lastMessageAt: (r.last_message_at as string) || null,
    lastMessageText: (r.last_message_text as string) || "",
    lastMessageAuthor: (r.last_message_author as string) || "",
    createdAt: r.created_at,
  };
}

// ═══════════ helpers ═══════════

async function isDMChannel(env: Env, channelId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT id FROM dm_channels WHERE id = ?")
    .bind(channelId)
    .first();
  return Boolean(row);
}

async function getMessages(
  env: Env,
  channelId: string,
  before?: string,
  limit = 50,
  pinnedOnly = false,
  threadId?: string
) {
  const dm = await isDMChannel(env, channelId);
  const table = dm ? "dm_messages" : "messages";
  const col = dm ? "dm_channel_id" : "channel_id";

  let sql = `SELECT * FROM ${table} WHERE ${col} = ?`;
  const binds: unknown[] = [channelId];
  if (threadId) {
    sql += " AND thread_id = ?";
    binds.push(threadId);
  } else if (pinnedOnly) {
    sql += " AND pinned = 1";
  } else {
    sql += " AND pinned = 0";
  }
  if (before) {
    sql += " AND timestamp < ?";
    binds.push(before);
  }
  sql += " ORDER BY timestamp ASC LIMIT ?";
  binds.push(Math.min(limit, 200));

  const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
  return (results || []).map(mapMessage);
}

async function insertMessage(
  env: Env,
  channelId: string,
  body: Record<string, unknown>,
  user: SessionUser
) {
  const dm = await isDMChannel(env, channelId);
  const table = dm ? "dm_messages" : "messages";
  const col = dm ? "dm_channel_id" : "channel_id";
  const id = genId();
  const ts = now();

  await env.DB.prepare(
    `INSERT INTO ${table}
       (id, ${col}, author, author_id, session_id, text, color, timestamp,
        reactions, edited, edited_at, pinned, pinned_at, file_url, file_type,
        file_name, file_size, reply_to, thread_id, mentions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      channelId,
      (body.author as string) || user.fullName || "Anonymous",
      (body.authorId as string) || user.id,
      (body.sessionId as string) || user.id,
      (body.text as string) || "",
      (body.color as string) || "#8B5CF6",
      (body.timestamp as string) || ts,
      stringifyJson(body.reactions || {}),
      (body.fileUrl as string) || null,
      (body.fileType as string) || null,
      (body.fileName as string) || null,
      (body.fileSize as number) || null,
      body.replyTo ? stringifyJson(body.replyTo) : null,
      (body.threadId as string) || null,
      body.mentions ? stringifyJson(body.mentions) : null,
      ts
    )
    .run();

  if (dm) {
    await env.DB.prepare(
      `UPDATE dm_channels SET last_message_at = ?, last_message_text = ?,
              last_message_author = ? WHERE id = ?`
    )
      .bind(
        ts,
        String(body.text || "").slice(0, 100),
        (body.author as string) || user.fullName || "Anonymous",
        channelId
      )
      .run();
  }

  // Queue web-push notifications (best-effort; delivered by cron / /push/send).
  const author = (body.author as string) || user.fullName || "Anonymous";
  const preview = String(body.text || "").slice(0, 120);
  if (dm) {
    const row = await env.DB.prepare("SELECT participants FROM dm_channels WHERE id = ?")
      .bind(channelId)
      .first<{ participants: string }>();
    const others = (parseJson<string[]>(row?.participants as string, []) || []).filter(
      (pid) => pid !== user.id
    );
    for (const oid of others) {
      if (await hasPushSubscriptions(env, oid)) {
        await queueNotification(env, oid, `${author} sent you a message`, preview, {
          type: "dm",
          channelId,
          messageId: id,
        });
      }
    }
  } else {
    const mentions = Array.isArray(body.mentions) ? (body.mentions as string[]) : [];
    for (const mid of mentions) {
      if (mid === user.id) continue;
      if (await hasPushSubscriptions(env, mid)) {
        await queueNotification(env, mid, `${author} mentioned you`, preview, {
          type: "mention",
          channelId,
          messageId: id,
        });
      }
    }
  }

  return id;
}

// ═══════════ handler ═══════════

export async function handleChat(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  // ── Messages ──
  const msgsMatch = p.match(/^\/channels\/([^/]+)\/messages$/);
  if (msgsMatch && method === "GET") {
    const before = url.searchParams.get("before") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const threadId = url.searchParams.get("thread") || undefined;
    const messages = await getMessages(env, msgsMatch[1], before, limit, false, threadId);
    return json({ messages }, 200, env);
  }
  if (msgsMatch && method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    const id = await insertMessage(env, msgsMatch[1], body, user);
    return json({ id }, 200, env);
  }

  const pinsMatch = p.match(/^\/channels\/([^/]+)\/pins$/);
  if (pinsMatch && method === "GET") {
    const messages = await getMessages(env, pinsMatch[1], undefined, 100, true);
    return json({ messages }, 200, env);
  }

  const msgMatch = p.match(/^\/messages\/([^/]+)$/);
  if (msgMatch && method === "GET") {
    let row = await env.DB.prepare("SELECT * FROM messages WHERE id = ?")
      .bind(msgMatch[1])
      .first<Record<string, unknown>>();
    if (!row) {
      row = await env.DB.prepare("SELECT * FROM dm_messages WHERE id = ?")
        .bind(msgMatch[1])
        .first<Record<string, unknown>>();
    }
    if (!row) return json({ error: "not_found" }, 404, env);
    return json(mapMessage(row), 200, env);
  }
  if (msgMatch && method === "PATCH") {
    const { text } = await readJson<{ text?: string }>(request);
    // IDs are unique across tables, so only one row is ever touched — updating
    // both is a safe no-op for the other and keeps DM edits working.
    const trimmed = (text || "").trim();
    const ts = now();
    await env.DB.batch([
      env.DB.prepare("UPDATE messages SET text = ?, edited = 1, edited_at = ? WHERE id = ?")
        .bind(trimmed, ts, msgMatch[1]),
      env.DB.prepare("UPDATE dm_messages SET text = ?, edited = 1, edited_at = ? WHERE id = ?")
        .bind(trimmed, ts, msgMatch[1]),
    ]);
    return json({ ok: true }, 200, env);
  }
  if (msgMatch && method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM messages WHERE id = ? OR thread_id = ?").bind(msgMatch[1], msgMatch[1]),
      env.DB.prepare("DELETE FROM dm_messages WHERE id = ?").bind(msgMatch[1]),
    ]);
    return json({ ok: true }, 200, env);
  }

  const threadMatch = p.match(/^\/threads\/([^/]+)$/);
  if (threadMatch && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM messages WHERE thread_id = ? ORDER BY timestamp ASC LIMIT 200"
    )
      .bind(threadMatch[1])
      .all<Record<string, unknown>>();
    return json({ messages: (results || []).map(mapMessage) }, 200, env);
  }

  const pinMatch = p.match(/^\/messages\/([^/]+)\/pin$/);
  if (pinMatch && method === "POST") {
    // Toggle across both tables so pinning a DM message isn't a silent no-op.
    let row = await env.DB.prepare("SELECT pinned FROM messages WHERE id = ?")
      .bind(pinMatch[1])
      .first<{ pinned: number }>();
    if (!row) {
      row = await env.DB.prepare("SELECT pinned FROM dm_messages WHERE id = ?")
        .bind(pinMatch[1])
        .first<{ pinned: number }>();
    }
    if (!row) return json({ error: "not_found" }, 404, env);
    const next = row.pinned ? 0 : 1;
    const pinnedAt = row.pinned ? null : now();
    await env.DB.batch([
      env.DB.prepare("UPDATE messages SET pinned = ?, pinned_at = ? WHERE id = ?").bind(next, pinnedAt, pinMatch[1]),
      env.DB.prepare("UPDATE dm_messages SET pinned = ?, pinned_at = ? WHERE id = ?").bind(next, pinnedAt, pinMatch[1]),
    ]);
    return json({ ok: true }, 200, env);
  }

  const reactMatch = p.match(/^\/messages\/([^/]+)\/reactions$/);
  if (reactMatch && method === "PUT") {
    const { reactions } = await readJson<{ reactions?: Record<string, string[]> }>(request);
    // Same as edit: update both tables so reactions on DM messages persist.
    const serialized = stringifyJson(reactions || {});
    await env.DB.batch([
      env.DB.prepare("UPDATE messages SET reactions = ? WHERE id = ?").bind(serialized, reactMatch[1]),
      env.DB.prepare("UPDATE dm_messages SET reactions = ? WHERE id = ?").bind(serialized, reactMatch[1]),
    ]);
    return json({ ok: true }, 200, env);
  }

  // ── DMs ──
  if (p === "/dm-channels" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM dm_channels ORDER BY created_at DESC").all<Record<string, unknown>>();
    const mine = (results || []).filter((r) =>
      parseJson<string[]>(r.participants as string, []).includes(user.id)
    );
    return json(mine.map(mapDM), 200, env);
  }
  if (p === "/dm-channels" && method === "POST") {
    const { participantId } = await readJson<{ participantId?: string }>(request);
    if (!participantId || participantId === user.id) return json({ error: "invalid_participant" }, 400, env);
    const { results } = await env.DB.prepare("SELECT * FROM dm_channels").all<Record<string, unknown>>();
    const existing = (results || []).find((r) => {
      const parts = parseJson<string[]>(r.participants as string, []);
      return parts.includes(user.id) && parts.includes(participantId);
    });
    if (existing) return json({ id: existing.id }, 200, env);
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO dm_channels (id, participants, participant_names, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(id, stringifyJson([user.id, participantId]), stringifyJson({ [user.id]: user.fullName }), now())
      .run();
    return json({ id }, 200, env);
  }

  // ── Typing ──
  if (p === "/typing" && method === "POST") {
    const { channelId, displayName } = await readJson<{ channelId?: string; displayName?: string }>(request);
    if (!channelId) return json({ error: "channelId_required" }, 400, env);
    const id = `${channelId}_${user.id}`;
    await env.DB.prepare(
      `INSERT INTO typing (id, channel_id, user_id, display_name, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at, display_name = excluded.display_name`
    )
      .bind(id, channelId, user.id, displayName || user.fullName, user.id, now())
      .run();
    return json({ ok: true }, 200, env);
  }
  if (p === "/typing" && method === "DELETE") {
    const channelId = url.searchParams.get("channelId");
    if (channelId) {
      await env.DB.prepare("DELETE FROM typing WHERE channel_id = ? AND session_id = ?")
        .bind(channelId, user.id)
        .run();
    }
    return json({ ok: true }, 200, env);
  }

  // ── Typing list (fallback when Ably is unavailable) ──
  if (p === "/typing" && method === "GET") {
    const channelId = url.searchParams.get("channelId");
    let sql = "SELECT * FROM typing";
    const binds: unknown[] = [];
    if (channelId) {
      sql += " WHERE channel_id = ?";
      binds.push(channelId);
    }
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return json(
      (results || []).map((r) => ({
        name: r.display_name,
        sessionId: r.session_id,
        channelId: r.channel_id,
      })),
      200,
      env
    );
  }

  return null;
}
