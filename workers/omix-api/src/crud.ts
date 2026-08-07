import type { Env } from "./env";
import {
  json,
  readJson,
  now,
  genId,
  genToken,
  parseJson,
  stringifyJson,
  getSessionUser,
  getAdminSettings,
  workerOrigin,
  type SessionUser,
} from "./util";

// ═══════════ mappers ═══════════

function mapServer(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    description: (r.description as string) || "",
    privacy: (r.privacy as string) || "private",
    icon: (r.icon as string) || "",
    memberCount: (r.member_count as number) || 1,
    ownerId: r.created_by,
    createdAt: r.created_at,
  };
}

function mapChannel(r: Record<string, unknown>) {
  return {
    id: r.id,
    serverId: r.server_id,
    name: r.name,
    category: (r.category as string) || "Text Channels",
    type: (r.type as string) || "text",
    topic: (r.topic as string) || "",
    position: (r.position as number) || 0,
    icon: (r.icon as string) || "",
    createdAt: r.created_at,
  };
}

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

function mapPresence(r: Record<string, unknown>) {
  return {
    id: r.session_id,
    name: r.display_name,
    color: r.color,
    online: Boolean(r.online),
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

function mapPost(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    authorId: r.author_id,
    authorName: r.author_name,
    authorAvatar: r.author_avatar,
    authorColor: r.author_color,
    voteCount: (r.vote_count as number) || 0,
    createdAt: r.created_at,
  };
}

function mapCall(r: Record<string, unknown>) {
  return {
    id: r.id,
    callerId: r.caller_id,
    calleeId: r.callee_id,
    callerName: (r.caller_name as string) || "",
    calleeName: (r.callee_name as string) || "",
    video: Boolean(r.video),
    status: (r.status as string) || "ended",
    startedAt: r.started_at,
    endedAt: (r.ended_at as string) || null,
    durationMs: (r.duration_ms as number) || null,
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

  return id;
}

// ═══════════ handlers ═══════════

export async function handleCrud(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  // ── Uploads / assets ──
  if (p === "/upload" && method === "POST") {
    const kind = (url.searchParams.get("kind") || "files").replace(/[^a-z-]/g, "");
    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "application/json": "json",
      "audio/mpeg": "mp3",
      "video/mp4": "mp4",
    };
    const ctype = request.headers.get("Content-Type") || "application/octet-stream";
    const ext = extMap[ctype.split(";")[0]] || "bin";
    const key = `${kind}/${Date.now()}_${genToken(4)}.${ext}`;
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 25 * 1024 * 1024) return json({ error: "file_too_large" }, 413, env);
    await env.ASSETS.put(key, buf, { metadata: { contentType: ctype } });
    return json({ url: `${workerOrigin(request)}/assets/${key}` }, 200, env);
  }


  // ── Config / admin ──
  if (p === "/config/settings" && method === "GET") {
    const settings = await getAdminSettings(env);
    return json({ adminEmail: settings.adminEmail || "", adminUid: settings.adminUid || "" }, 200, env);
  }
  if (p === "/config/settings" && method === "PUT") {
    if (!user.isAdmin) return json({ error: "forbidden" }, 403, env);
    const body = await readJson<Record<string, unknown>>(request);
    const current = await getAdminSettings(env);
    const next = { ...current, ...body };
    await env.DB.prepare(
      `INSERT INTO config (id, data, created_at, updated_at) VALUES ('settings', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
      .bind(stringifyJson(next), now(), now())
      .run();
    return json({ ok: true }, 200, env);
  }

  if (p === "/admin/verify-password" && method === "POST") {
    const { password } = await readJson<{ password?: string }>(request);
    const settings = await getAdminSettings(env);
    return json({ valid: Boolean(settings.adminPassword) && settings.adminPassword === password }, 200, env);
  }

  // ── Servers ──
  if (p === "/servers/public" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM servers WHERE privacy = 'public' ORDER BY name"
    ).all<Record<string, unknown>>();
    return json((results || []).map(mapServer), 200, env);
  }
  if (p === "/servers" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM servers ORDER BY name").all<Record<string, unknown>>();
    return json((results || []).map(mapServer), 200, env);
  }
  if (p === "/servers" && method === "POST") {
    const body = await readJson<{ name?: string; description?: string; privacy?: string }>(request);
    if (!body.name || !body.name.trim()) return json({ error: "name_required" }, 400, env);
    const id = genId();
    const ts = now();
    await env.DB.prepare(
      `INSERT INTO servers (id, name, description, privacy, icon, member_count, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', 1, ?, ?, ?)`
    )
      .bind(id, body.name.trim(), (body.description || "").trim(), body.privacy || "private", user.id, ts, ts)
      .run();
    return json({ id }, 200, env);
  }

  const serverMatch = p.match(/^\/servers\/([^/]+)$/);
  if (serverMatch) {
    const id = serverMatch[1];
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM servers WHERE id = ?").bind(id).first<Record<string, unknown>>();
      if (!row) return json({ error: "not_found" }, 404, env);
      return json(mapServer(row), 200, env);
    }
    if (method === "PATCH") {
      const body = await readJson<Record<string, unknown>>(request);
      const fields: string[] = [];
      const vals: unknown[] = [];
      for (const [col, key] of [
        ["name", "name"],
        ["description", "description"],
        ["privacy", "privacy"],
        ["icon", "icon"],
      ] as const) {
        if (body[key] !== undefined) {
          fields.push(`${col} = ?`);
          vals.push(body[key]);
        }
      }
      if (fields.length === 0) return json({ error: "nothing_to_update" }, 400, env);
      fields.push("updated_at = ?");
      vals.push(now(), id);
      await env.DB.prepare(`UPDATE servers SET ${fields.join(", ")} WHERE id = ?`).bind(...vals).run();
      return json({ ok: true }, 200, env);
    }
    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM channels WHERE server_id = ?").bind(id),
        env.DB.prepare("DELETE FROM invites WHERE server_id = ?").bind(id),
        env.DB.prepare("DELETE FROM servers WHERE id = ?").bind(id),
      ]);
      return json({ ok: true }, 200, env);
    }
  }

  // ── Invites ──
  const inviteMatch = p.match(/^\/servers\/([^/]+)\/invite$/);
  if (inviteMatch && method === "POST") {
    const code = genToken(4);
    await env.DB.prepare(
      "INSERT INTO invites (code, server_id, created_by, uses, created_at) VALUES (?, ?, ?, 0, ?)"
    )
      .bind(code, inviteMatch[1], user.id, now())
      .run();
    return json({ code }, 200, env);
  }
  if (p === "/invites/join" && method === "POST") {
    const { code } = await readJson<{ code?: string }>(request);
    const row = await env.DB.prepare("SELECT * FROM invites WHERE code = ?").bind(code || "").first<Record<string, unknown>>();
    if (!row) return json({ error: "invalid_code" }, 404, env);
    await env.DB.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?").bind(code).run();
    await env.DB.prepare(
      `INSERT INTO server_members (id, server_id, user_id, role, joined_at, last_read_at)
       VALUES (?, ?, ?, 'member', ?, ?) ON CONFLICT DO NOTHING`
    )
      .bind(genId(), row.server_id, user.id, now(), now())
      .run();
    return json({ serverId: row.server_id }, 200, env);
  }

  // ── Channels ──
  const channelsMatch = p.match(/^\/servers\/([^/]+)\/channels$/);
  if (channelsMatch && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM channels WHERE server_id = ? ORDER BY name"
    )
      .bind(channelsMatch[1])
      .all<Record<string, unknown>>();
    return json((results || []).map(mapChannel), 200, env);
  }
  if (channelsMatch && method === "POST") {
    const body = await readJson<{ name?: string; category?: string; type?: string; icon?: string; topic?: string }>(request);
    if (!body.name || !body.name.trim()) return json({ error: "name_required" }, 400, env);
    const id = genId();
    const ts = now();
    await env.DB.prepare(
      `INSERT INTO channels (id, server_id, name, category, type, topic, position, icon, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        channelsMatch[1],
        body.name.trim().toLowerCase().replace(/\s+/g, "-"),
        body.category || "Text Channels",
        body.type || "text",
        body.topic || "",
        (body.icon ? 1 : 0),
        body.icon || "",
        user.id,
        ts,
        ts
      )
      .run();
    return json({ id }, 200, env);
  }

  const channelMatch = p.match(/^\/channels\/([^/]+)$/);
  if (channelMatch && method === "PATCH") {
    const body = await readJson<Record<string, unknown>>(request);
    const fields: string[] = [];
    const vals: unknown[] = [];
    for (const [col, key] of [["name", "name"], ["icon", "icon"], ["topic", "topic"]] as const) {
      if (body[key] !== undefined) {
        fields.push(`${col} = ?`);
        vals.push(body[key]);
      }
    }
    if (fields.length === 0) return json({ error: "nothing_to_update" }, 400, env);
    fields.push("updated_at = ?");
    vals.push(now(), channelMatch[1]);
    await env.DB.prepare(`UPDATE channels SET ${fields.join(", ")} WHERE id = ?`).bind(...vals).run();
    return json({ ok: true }, 200, env);
  }
  if (channelMatch && method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM messages WHERE channel_id = ?").bind(channelMatch[1]),
      env.DB.prepare("DELETE FROM channels WHERE id = ?").bind(channelMatch[1]),
    ]);
    return json({ ok: true }, 200, env);
  }

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
    await env.DB.prepare("UPDATE messages SET text = ?, edited = 1, edited_at = ? WHERE id = ?")
      .bind((text || "").trim(), now(), msgMatch[1])
      .run();
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
    const row = await env.DB.prepare("SELECT pinned FROM messages WHERE id = ?").bind(pinMatch[1]).first<{ pinned: number }>();
    if (!row) return json({ error: "not_found" }, 404, env);
    await env.DB.prepare("UPDATE messages SET pinned = ?, pinned_at = ? WHERE id = ?")
      .bind(row.pinned ? 0 : 1, row.pinned ? null : now(), pinMatch[1])
      .run();
    return json({ ok: true }, 200, env);
  }

  const reactMatch = p.match(/^\/messages\/([^/]+)\/reactions$/);
  if (reactMatch && method === "PUT") {
    const { reactions } = await readJson<{ reactions?: Record<string, string[]> }>(request);
    await env.DB.prepare("UPDATE messages SET reactions = ? WHERE id = ?")
      .bind(stringifyJson(reactions || {}), reactMatch[1])
      .run();
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

  // ── Profiles ──
  const profileMatch = p.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch && method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM profiles WHERE session_id = ?")
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
      },
      200,
      env
    );
  }
  if (p === "/profiles" && method === "PUT") {
    const body = await readJson<{ name?: string; avatar?: string; color?: string }>(request);
    const ts = now();
    const name = (body.name || user.fullName || "").trim();
    await env.DB.prepare(
      `INSERT INTO profiles (id, session_id, name, avatar, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar,
         color = excluded.color, updated_at = excluded.updated_at`
    )
      .bind(genId(), user.id, name, body.avatar || "", body.color || "#8B5CF6", ts, ts)
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

  // ── Call log ──
  if (p === "/call-log" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const { results } = await env.DB.prepare(
      "SELECT * FROM call_log WHERE caller_id = ? OR callee_id = ? ORDER BY started_at DESC LIMIT ?"
    )
      .bind(user.id, user.id, limit)
      .all<Record<string, unknown>>();
    return json((results || []).map(mapCall), 200, env);
  }
  if (p === "/call-log" && method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    // Upsert on id so both parties (start + end) collapse into a single row.
    const id = (body.id as string) || genId();
    await env.DB.prepare(
      `INSERT INTO call_log (id, caller_id, callee_id, caller_name, callee_name, video, status, started_at, ended_at, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         ended_at = COALESCE(excluded.ended_at, call_log.ended_at),
         duration_ms = COALESCE(excluded.duration_ms, call_log.duration_ms)`
    )
      .bind(
        id,
        body.callerId || user.id,
        body.calleeId || "",
        (body.callerName as string) || "",
        (body.calleeName as string) || "",
        body.video ? 1 : 0,
        (body.status as string) || "ringing",
        (body.startedAt as string) || now(),
        (body.endedAt as string) || null,
        (body.durationMs as number) || null,
        now()
      )
      .run();
    return json({ id }, 200, env);
  }

  // ── Boardroom ──
  if (p === "/board-posts/mine-votes" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT post_id FROM board_votes WHERE session_id = ?"
    )
      .bind(user.id)
      .all<{ post_id: string }>();
    const votes: Record<string, number> = {};
    (results || []).forEach((r) => {
      votes[r.post_id] = 1;
    });
    return json({ votes }, 200, env);
  }
  const voteMatch = p.match(/^\/board-posts\/([^/]+)\/vote$/);
  if (voteMatch && method === "POST") {
    await env.DB.prepare(
      "INSERT INTO board_votes (post_id, session_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING"
    )
      .bind(voteMatch[1], user.id, now())
      .run();
    await recomputeVotes(env, voteMatch[1]);
    return json({ ok: true }, 200, env);
  }
  if (voteMatch && method === "DELETE") {
    await env.DB.prepare("DELETE FROM board_votes WHERE post_id = ? AND session_id = ?")
      .bind(voteMatch[1], user.id)
      .run();
    await recomputeVotes(env, voteMatch[1]);
    return json({ ok: true }, 200, env);
  }
  if (p === "/board-posts" && method === "GET") {
    const category = url.searchParams.get("category");
    let sql = "SELECT * FROM board_posts";
    const binds: unknown[] = [];
    if (category && category !== "all") {
      sql += " WHERE category = ?";
      binds.push(category);
    }
    sql += " ORDER BY vote_count DESC, created_at DESC LIMIT 200";
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return json((results || []).map(mapPost), 200, env);
  }
  if (p === "/board-posts" && method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO board_posts (id, title, body, category, author_id, author_name, author_avatar, author_color, vote_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
      .bind(
        id,
        (body.title as string) || "",
        (body.body as string) || "",
        (body.category as string) || "general",
        (body.authorId as string) || user.id,
        (body.authorName as string) || user.fullName,
        (body.authorAvatar as string) || "",
        (body.authorColor as string) || "#a078ff",
        now()
      )
      .run();
    return json({ id }, 200, env);
  }

  // ── Notification settings ──
  if (p === "/notification-settings" && method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM notification_settings WHERE session_id = ?")
      .bind(user.id)
      .first<Record<string, unknown>>();
    if (!row) {
      return json(
        { pushEnabled: false, soundEnabled: true, messageSound: "Pop", callRingtone: "Classic", dndEnabled: false, dndDays: [], dndStart: "22:00", dndEnd: "08:00" },
        200,
        env
      );
    }
    return json(
      {
        pushEnabled: Boolean(row.push_enabled),
        soundEnabled: Boolean(row.sound_enabled),
        messageSound: row.message_sound,
        callRingtone: row.call_ringtone,
        dndEnabled: Boolean(row.dnd_enabled),
        dndDays: parseJson<string[]>(row.dnd_days as string, []),
        dndStart: row.dnd_start,
        dndEnd: row.dnd_end,
      },
      200,
      env
    );
  }
  if (p === "/notification-settings" && method === "PUT") {
    const body = await readJson<Record<string, unknown>>(request);
    await env.DB.prepare(
      `INSERT INTO notification_settings (session_id, push_enabled, sound_enabled, message_sound, call_ringtone, dnd_enabled, dnd_days, dnd_start, dnd_end, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET push_enabled = excluded.push_enabled,
         sound_enabled = excluded.sound_enabled, message_sound = excluded.message_sound,
         call_ringtone = excluded.call_ringtone, dnd_enabled = excluded.dnd_enabled,
         dnd_days = excluded.dnd_days, dnd_start = excluded.dnd_start, dnd_end = excluded.dnd_end,
         updated_at = excluded.updated_at`
    )
      .bind(
        user.id,
        body.pushEnabled ? 1 : 0,
        body.soundEnabled !== false ? 1 : 0,
        (body.messageSound as string) || "Pop",
        (body.callRingtone as string) || "Classic",
        body.dndEnabled ? 1 : 0,
        stringifyJson(body.dndDays || []),
        (body.dndStart as string) || "22:00",
        (body.dndEnd as string) || "08:00",
        now()
      )
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Notifications queue ──
  if (p === "/notifications/queue" && method === "POST") {
    const body = await readJson<{ userId?: string; title?: string; body?: string; data?: Record<string, unknown> }>(request);
    if (!body.userId || !body.title) return json({ error: "userId and title are required" }, 400, env);
    await env.DB.prepare(
      "INSERT INTO notifications (id, target_user_id, title, body, data, sent, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)"
    )
      .bind(genId(), body.userId, body.title, body.body || "", stringifyJson(body.data || {}), now())
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Auth / me endpoints handled by the router ──
  return null;
}

/** Serve an uploaded file. Called from the router BEFORE the auth gate so
 *  images/files are publicly readable (browsers don't send Authorization). */
export async function serveAsset(env: Env, key: string): Promise<Response | null> {
  const { value, metadata } = await env.ASSETS.getWithMetadata(key, { type: "arrayBuffer" });
  if (value === null) return null;
  const meta = (metadata || {}) as { contentType?: string };
  const headers = new Headers();
  headers.set("Content-Type", meta.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  return new Response(value, { headers });
}

async function recomputeVotes(env: Env, postId: string): Promise<void> {
  const { results } = await env.DB.prepare("SELECT post_id FROM board_votes WHERE post_id = ?")
    .bind(postId)
    .all<{ post_id: string }>();
  const count = (results || []).length;
  await env.DB.prepare("UPDATE board_posts SET vote_count = ? WHERE id = ?").bind(count, postId).run();
}

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

export { getSessionUser };
