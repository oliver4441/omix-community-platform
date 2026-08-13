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
import { refreshFeed } from "../../feed/ingest";
import {
  hasCapability,
  normalizeRole,
  type Capability,
} from "./permissions";
import {
  getMembership,
  requireMembership,
  memberCapabilities,
  can,
  isMuted,
  logAudit,
} from "./moderation";
import { messageRateLimit } from "./ratelimit";
import {
  createNotification,
  resolveUsersByName,
  getChannelNotificationLevel,
} from "./notifications";

const MAX_TEXT_LEN = 4000;
const MAX_MENTIONS = 50;
const MAX_TITLE_LEN = 200;
const MAX_BODY_LEN = 20_000;

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
    deleted: Boolean(r.deleted),
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

function mapFeedPost(r: Record<string, unknown>) {
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    sourceUrl: r.source_url,
    title: r.title,
    summary: r.summary,
    tags: parseJson<string[]>(r.tags as string, []),
    category: r.category,
    thumbnail: r.thumbnail,
    imageUrl: r.image_url,
    author: r.author,
    score: r.score,
    numComments: r.num_comments,
    comments: parseJson<{ author: string; text: string }[]>(r.comments as string, []),
    relatedRepos: parseJson<{ name: string; url: string; stars: number }[]>(r.related_repos as string, []),
    publishedAt: r.published_at,
    fetchedAt: r.fetched_at,
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

/** Resolve the display name server-side (profiles → users) so it can't be spoofed. */
async function displayNameFor(env: Env, user: SessionUser): Promise<string> {
  try {
    const row = await env.DB.prepare("SELECT name FROM profiles WHERE session_id = ?")
      .bind(user.id)
      .first<{ name: string }>();
    if (row?.name) return row.name;
  } catch {
    /* ignore */
  }
  return user.fullName || "Anonymous";
}

/**
 * Membership for the server that owns a channel, plus channel overrides.
 * Returns { member, role, overrides, isDm, dmParticipants } — caller decides
 * which combinations are allowed.
 */
async function channelContext(env: Env, channelId: string, userId: string) {
  const dmRow = await env.DB.prepare("SELECT * FROM dm_channels WHERE id = ?")
    .bind(channelId)
    .first<Record<string, unknown>>();
  if (dmRow) {
    const participants = parseJson<string[]>(dmRow.participants as string, []);
    return {
      isDm: true,
      dmParticipants: participants,
      isParticipant: participants.includes(userId),
      member: null,
      role: null,
      overrides: [],
      serverId: null,
    };
  }
  const channel = await env.DB.prepare("SELECT server_id FROM channels WHERE id = ?")
    .bind(channelId)
    .first<{ server_id: string }>();
  if (!channel) return { isDm: false, dmParticipants: [], isParticipant: false, member: null, role: null, overrides: [], serverId: null };
  const member = await getMembership(env, channel.server_id, userId);
  if (!member) {
    return { isDm: false, dmParticipants: [], isParticipant: false, member: null, role: null, overrides: [], serverId: channel.server_id };
  }
  const { role, overrides } = await memberCapabilities(env, member, channelId);
  return { isDm: false, dmParticipants: [], isParticipant: true, member, role, overrides, serverId: channel.server_id };
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

  let sql = `SELECT * FROM ${table} WHERE ${col} = ? AND deleted = 0`;
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

interface InsertMessageResult {
  id: string;
  error?: string;
}

async function insertMessage(
  env: Env,
  channelId: string,
  body: Record<string, unknown>,
  user: SessionUser
): Promise<InsertMessageResult> {
  const ctx = await channelContext(env, channelId, user.id);

  // ── Authorization ──
  if (ctx.isDm) {
    if (!ctx.isParticipant) return { id: "", error: "not_a_participant" };
  } else {
    if (!ctx.member) return { id: "", error: "not_a_member" };
    if (ctx.member.banned) return { id: "", error: "banned" };
    if (isMuted(ctx.member)) return { id: "", error: "muted" };
    const { role, overrides } = ctx;
    if (role && !hasCapability(role, "SEND_MESSAGES", overrides))
      return { id: "", error: "forbidden" };
  }

  // ── Flood protection ──
  const rl = await messageRateLimit(env, user.id);
  if (!rl.ok) return { id: "", error: "flood_protected" };

  // ── Input validation ──
  const text = String(body.text || "").trim().slice(0, MAX_TEXT_LEN);
  const hasFile = Boolean(body.fileUrl);
  if (!text && !hasFile) return { id: "", error: "empty_message" };
  if (body.fileUrl && typeof body.fileUrl !== "string")
    return { id: "", error: "invalid_file" };

  let mentions: string[] = Array.isArray(body.mentions)
    ? body.mentions.filter((m): m is string => typeof m === "string" && m.length > 0).slice(0, MAX_MENTIONS)
    : [];
  // @everyone / @here requires the MENTION_EVERYONE capability.
  const massMention = mentions.some((m) => m === "@everyone" || m === "@here");
  if (massMention) {
    if (!ctx.isDm && ctx.role && !hasCapability(ctx.role, "MENTION_EVERYONE", ctx.overrides)) {
      mentions = mentions.filter((m) => m !== "@everyone" && m !== "@here");
    }
  }
  if (!massMention && mentions.length > 10) {
    mentions = mentions.slice(0, 10);
  }

  // ── Idempotency (offline outbox replays) ──
  const nonce = typeof body.nonce === "string" && body.nonce.length <= 64 ? body.nonce : "";
  if (nonce) {
    const dup = await env.DB.prepare("SELECT id FROM messages WHERE nonce = ?")
      .bind(nonce)
      .first<{ id: string }>();
    if (dup) return { id: dup.id };
  }

  const table = ctx.isDm ? "dm_messages" : "messages";
  const col = ctx.isDm ? "dm_channel_id" : "channel_id";
  const id = genId();
  const ts = now();
  const author = await displayNameFor(env, user);

  await env.DB.prepare(
    `INSERT INTO ${table}
       (id, ${col}, author, author_id, session_id, text, color, timestamp,
        reactions, edited, edited_at, pinned, pinned_at, file_url, file_type,
        file_name, file_size, reply_to, thread_id, mentions, nonce, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      channelId,
      author,
      user.id,
      user.id,
      text,
      String(body.color || "#8B5CF6").slice(0, 20),
      typeof body.timestamp === "string" && !Number.isNaN(Date.parse(body.timestamp))
        ? body.timestamp
        : ts,
      stringifyJson({}),
      typeof body.fileUrl === "string" ? body.fileUrl : null,
      String(body.fileType || "").slice(0, 100) || null,
      String(body.fileName || "").slice(0, 255) || null,
      typeof body.fileSize === "number" ? body.fileSize : null,
      body.replyTo ? stringifyJson(body.replyTo) : null,
      typeof body.threadId === "string" ? body.threadId.slice(0, 64) : null,
      mentions.length > 0 ? stringifyJson(mentions) : null,
      nonce || null,
      ts
    )
    .run();

  if (ctx.isDm) {
    await env.DB.prepare(
      `UPDATE dm_channels SET last_message_at = ?, last_message_text = ?,
              last_message_author = ? WHERE id = ?`
    )
      .bind(ts, text.slice(0, 100) || (body.fileName as string) || "📎 attachment", author, channelId)
      .run();
  }

  // ── Notifications ──
  await afterMessageInsert(env, ctx, { id, channelId, text, author, mentions, replyTo: body.replyTo, threadId: body.threadId }, user);

  return { id };
}

async function afterMessageInsert(
  env: Env,
  ctx: Awaited<ReturnType<typeof channelContext>>,
  msg: { id: string; channelId: string; text: string; author: string; mentions: string[]; replyTo?: unknown; threadId?: unknown },
  user: SessionUser
) {
  const level = ctx.isDm
    ? "default"
    : await getChannelNotificationLevel(env, user.id, msg.channelId);
  if (level === "muted") return;

  const mentionsAllowed = level === "mentions" || level === "default";
  const generalAllowed = level === "default";

  // Mentions → resolve display names to users, notify each.
  if (mentionsAllowed && msg.mentions.length > 0) {
    const targets = await resolveUsersByName(env, msg.mentions);
    for (const targetId of targets) {
      if (targetId === user.id) continue;
      await createNotification(env, {
        targetUserId: targetId,
        type: "mention",
        title: `${msg.author} mentioned you`,
        body: msg.text.slice(0, 200) || "in a message",
        data: { channelId: msg.channelId, messageId: msg.id, serverId: ctx.serverId || "" },
      });
    }
  }

  // Replies → notify the parent message author.
  if (generalAllowed && (msg.replyTo || msg.threadId)) {
    const parentId = String((msg.threadId as string) || (msg.replyTo as { id?: string })?.id || "");
    if (parentId) {
      const table = ctx.isDm ? "dm_messages" : "messages";
      const parent = await env.DB.prepare(`SELECT author_id, author FROM ${table} WHERE id = ?`)
        .bind(parentId)
        .first<{ author_id: string; author: string }>();
      if (parent && parent.author_id && parent.author_id !== user.id) {
        await createNotification(env, {
          targetUserId: parent.author_id,
          type: "reply",
          title: `${msg.author} replied to you`,
          body: msg.text.slice(0, 200) || "in a message",
          data: { channelId: msg.channelId, messageId: parentId, serverId: ctx.serverId || "" },
        });
      }
    }
  }

  // DMs → notify the other participant(s).
  if (generalAllowed && ctx.isDm && ctx.dmParticipants.length > 0) {
    for (const participantId of ctx.dmParticipants) {
      if (participantId === user.id) continue;
      await createNotification(env, {
        targetUserId: participantId,
        type: "dm",
        title: `New message from ${msg.author}`,
        body: msg.text.slice(0, 200) || "📎 Attachment",
        data: { channelId: msg.channelId, messageId: msg.id, serverId: "" },
      });
    }
  }
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
    const ctype = (request.headers.get("Content-Type") || "application/octet-stream").split(";")[0].toLowerCase();
    // Allowlist by kind — never accept active content (SVG/HTML/JS/WASM/exe).
    const allowed: Record<string, string[]> = {
      icons: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      avatars: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      "channel-icons": ["image/png", "image/jpeg", "image/gif", "image/webp"],
      uploads: [
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "video/mp4", "video/webm",
        "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
        "application/pdf", "text/plain", "application/json",
      ],
      files: [
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "video/mp4", "video/webm",
        "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
        "application/pdf", "text/plain", "application/json",
        "application/zip",
      ],
    };
    const kinds = allowed[kind] || allowed.uploads;
    if (!kinds.includes(ctype)) return json({ error: "file_type_not_allowed" }, 415, env);

    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/webm": "weba",
      "application/pdf": "pdf",
      "application/json": "json",
      "application/zip": "zip",
      "text/plain": "txt",
    };
    const ext = extMap[ctype] || "bin";
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
    // Privacy: only communities the caller belongs to (or created, or which are
    // public) are listed — private communities of other users are not leaked.
    const { results } = await env.DB.prepare(
      `SELECT s.* FROM servers s
       LEFT JOIN server_members m ON m.server_id = s.id AND m.user_id = ? AND m.banned = 0
       WHERE s.privacy = 'public' OR s.created_by = ? OR m.id IS NOT NULL
       ORDER BY s.name`
    )
      .bind(user.id, user.id)
      .all<Record<string, unknown>>();
    return json((results || []).map(mapServer), 200, env);
  }
  if (p === "/servers" && method === "POST") {
    const body = await readJson<{ name?: string; description?: string; privacy?: string }>(request);
    if (!body.name || !body.name.trim()) return json({ error: "name_required" }, 400, env);
    const name = body.name.trim().slice(0, MAX_TITLE_LEN);
    const id = genId();
    const ts = now();
    // Creator becomes the owner — insert the membership row (RBAC baseline).
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO servers (id, name, description, privacy, icon, member_count, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', 1, ?, ?, ?)`
      ).bind(id, name, (body.description || "").trim().slice(0, 2000), body.privacy === "public" ? "public" : "private", user.id, ts, ts),
      env.DB.prepare(
        `INSERT INTO server_members (id, server_id, user_id, role, joined_at, last_read_at, muted_until, banned)
         VALUES (?, ?, ?, 'owner', ?, ?, NULL, 0)`
      ).bind(genId(), id, user.id, ts, ts),
    ]);
    await logAudit(env, {
      serverId: id,
      actorId: user.id,
      actorName: user.fullName,
      action: "server_create",
      targetType: "server",
      targetId: id,
      metadata: { name },
    });
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
      const member = await requireMembership(env, id, user.id);
      if (!member) return json({ error: "not_a_member" }, 403, env);
      if (!can(env, member, "MANAGE_SERVER"))
        return json({ error: "forbidden" }, 403, env);
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
          vals.push(
            key === "name" ? String(body[key]).trim().slice(0, MAX_TITLE_LEN)
            : key === "privacy" ? (body[key] === "public" ? "public" : "private")
            : String(body[key]).slice(0, 2000)
          );
        }
      }
      if (fields.length === 0) return json({ error: "nothing_to_update" }, 400, env);
      fields.push("updated_at = ?");
      vals.push(now(), id);
      await env.DB.prepare(`UPDATE servers SET ${fields.join(", ")} WHERE id = ?`).bind(...vals).run();
      await logAudit(env, {
        serverId: id,
        actorId: user.id,
        actorName: user.fullName,
        action: "server_update",
        targetType: "server",
        targetId: id,
      });
      return json({ ok: true }, 200, env);
    }
    if (method === "DELETE") {
      const member = await requireMembership(env, id, user.id);
      if (!member || !can(env, member, "MANAGE_SERVER"))
        return json({ error: "forbidden" }, 403, env);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM channels WHERE server_id = ?").bind(id),
        env.DB.prepare("DELETE FROM invites WHERE server_id = ?").bind(id),
        env.DB.prepare("DELETE FROM server_members WHERE server_id = ?").bind(id),
        env.DB.prepare("DELETE FROM servers WHERE id = ?").bind(id),
      ]);
      return json({ ok: true }, 200, env);
    }
  }

  // ── Invites ──
  const inviteMatch = p.match(/^\/servers\/([^/]+)\/invite$/);
  if (inviteMatch && method === "POST") {
    const member = await requireMembership(env, inviteMatch[1], user.id);
    if (!member || !can(env, member, "CREATE_INVITE"))
      return json({ error: "forbidden" }, 403, env);
    const code = genToken(4);
    await env.DB.prepare(
      "INSERT INTO invites (code, server_id, created_by, uses, created_at) VALUES (?, ?, ?, 0, ?)"
    )
      .bind(code, inviteMatch[1], user.id, now())
      .run();
    await logAudit(env, {
      serverId: inviteMatch[1],
      actorId: user.id,
      actorName: user.fullName,
      action: "invite_create",
      targetType: "invite",
      targetId: code,
    });
    return json({ code }, 200, env);
  }
  if (p === "/invites/join" && method === "POST") {
    const { code } = await readJson<{ code?: string }>(request);
    const row = await env.DB.prepare("SELECT * FROM invites WHERE code = ?").bind(code || "").first<Record<string, unknown>>();
    if (!row) return json({ error: "invalid_code" }, 404, env);
    const existing = await getMembership(env, row.server_id as string, user.id);
    if (existing?.banned) return json({ error: "banned" }, 403, env);
    await env.DB.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?").bind(code).run();
    await env.DB.prepare(
      `INSERT INTO server_members (id, server_id, user_id, role, joined_at, last_read_at, muted_until, banned)
       VALUES (?, ?, ?, 'member', ?, ?, NULL, 0) ON CONFLICT(server_id, user_id) DO NOTHING`
    )
      .bind(genId(), row.server_id, user.id, now(), now())
      .run();
    await env.DB.prepare("UPDATE servers SET member_count = member_count + 1 WHERE id = ?")
      .bind(row.server_id)
      .run();
    // Notify the owner of the join.
    const server = await env.DB.prepare("SELECT created_by, name FROM servers WHERE id = ?")
      .bind(row.server_id)
      .first<{ created_by: string; name: string }>();
    if (server && server.created_by !== user.id) {
      await createNotification(env, {
        targetUserId: server.created_by,
        type: "invite",
        title: `${user.fullName || "Someone"} joined ${server.name}`,
        data: { serverId: row.server_id as string },
      });
    }
    await logAudit(env, {
      serverId: row.server_id as string,
      actorId: user.id,
      actorName: user.fullName,
      action: "member_join",
      targetType: "user",
      targetId: user.id,
      metadata: { invite: code },
    });
    return json({ serverId: row.server_id }, 200, env);
  }

  // ── Channels ──
  const channelsMatch = p.match(/^\/servers\/([^/]+)\/channels$/);
  if (channelsMatch && method === "GET") {
    const serverId = channelsMatch[1];
    const member = await getMembership(env, serverId, user.id);
    if (!member || member.banned) {
      // Non-members may only browse public communities.
      const row = await env.DB.prepare("SELECT privacy FROM servers WHERE id = ?")
        .bind(serverId)
        .first<{ privacy: string }>();
      if (!row || row.privacy !== "public") return json({ error: "not_a_member" }, 403, env);
    }
    const { results } = await env.DB.prepare(
      "SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC, name ASC"
    )
      .bind(serverId)
      .all<Record<string, unknown>>();
    return json((results || []).map(mapChannel), 200, env);
  }
  if (channelsMatch && method === "POST") {
    const member = await requireMembership(env, channelsMatch[1], user.id);
    if (!member || !can(env, member, "CREATE_CHANNELS"))
      return json({ error: "forbidden" }, 403, env);
    const body = await readJson<{ name?: string; category?: string; type?: string; icon?: string; topic?: string }>(request);
    if (!body.name || !body.name.trim()) return json({ error: "name_required" }, 400, env);
    const name = body.name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64);
    const id = genId();
    const ts = now();
    await env.DB.prepare(
      `INSERT INTO channels (id, server_id, name, category, type, topic, position, icon, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        channelsMatch[1],
        name,
        String(body.category || "Text Channels").slice(0, 100),
        body.type === "voice" || body.type === "announcement" ? body.type : "text",
        String(body.topic || "").slice(0, 500),
        body.icon ? 1 : 0,
        typeof body.icon === "string" ? body.icon.slice(0, 1000) : "",
        user.id,
        ts,
        ts
      )
      .run();
    await logAudit(env, {
      serverId: channelsMatch[1],
      actorId: user.id,
      actorName: user.fullName,
      action: "channel_create",
      targetType: "channel",
      targetId: id,
      metadata: { name },
    });
    return json({ id }, 200, env);
  }

  const channelMatch = p.match(/^\/channels\/([^/]+)$/);
  if (channelMatch && (method === "PATCH" || method === "DELETE")) {
    const channel = await env.DB.prepare("SELECT server_id FROM channels WHERE id = ?")
      .bind(channelMatch[1])
      .first<{ server_id: string }>();
    if (!channel) return json({ error: "not_found" }, 404, env);
    const member = await requireMembership(env, channel.server_id, user.id);
    if (!member || !can(env, member, "MANAGE_CHANNELS"))
      return json({ error: "forbidden" }, 403, env);
    if (method === "PATCH") {
      const body = await readJson<Record<string, unknown>>(request);
      const fields: string[] = [];
      const vals: unknown[] = [];
      for (const [col, key] of [["name", "name"], ["icon", "icon"], ["topic", "topic"]] as const) {
        if (body[key] !== undefined) {
          fields.push(`${col} = ?`);
          vals.push(
            key === "name" ? String(body[key]).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64)
            : String(body[key]).slice(0, 1000)
          );
        }
      }
      if (fields.length === 0) return json({ error: "nothing_to_update" }, 400, env);
      fields.push("updated_at = ?");
      vals.push(now(), channelMatch[1]);
      await env.DB.prepare(`UPDATE channels SET ${fields.join(", ")} WHERE id = ?`).bind(...vals).run();
      return json({ ok: true }, 200, env);
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM messages WHERE channel_id = ?").bind(channelMatch[1]),
      env.DB.prepare("DELETE FROM channels WHERE id = ?").bind(channelMatch[1]),
    ]);
    await logAudit(env, {
      serverId: channel.server_id,
      actorId: user.id,
      actorName: user.fullName,
      action: "channel_delete",
      targetType: "channel",
      targetId: channelMatch[1],
    });
    return json({ ok: true }, 200, env);
  }

  // ── Messages ──
  const msgsMatch = p.match(/^\/channels\/([^/]+)\/messages$/);
  if (msgsMatch && method === "GET") {
    const ctx = await channelContext(env, msgsMatch[1], user.id);
    if (!ctx.isDm) {
      if (!ctx.member) return json({ error: "not_a_member" }, 403, env);
      const { role, overrides } = ctx;
      if (role && !hasCapability(role, "READ_MESSAGE_HISTORY", overrides))
        return json({ error: "forbidden" }, 403, env);
    }
    const before = url.searchParams.get("before") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const threadId = url.searchParams.get("thread") || undefined;
    const messages = await getMessages(env, msgsMatch[1], before, limit, false, threadId);
    return json({ messages }, 200, env);
  }
  if (msgsMatch && method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    const result = await insertMessage(env, msgsMatch[1], body, user);
    if (result.error) {
      const status = result.error === "flood_protected" ? 429 : 403;
      return json({ error: result.error }, status, env);
    }
    return json({ id: result.id }, 200, env);
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
    const row =
      (await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(msgMatch[1]).first<Record<string, unknown>>()) ||
      (await env.DB.prepare("SELECT * FROM dm_messages WHERE id = ?").bind(msgMatch[1]).first<Record<string, unknown>>());
    if (!row) return json({ error: "not_found" }, 404, env);
    const isDm = !row.channel_id;
    const channelId = (row.channel_id as string) || (row.dm_channel_id as string);
    const isAuthor =
      (row.author_id as string) === user.id ||
      ((row.author_id as string) || "") === "" && (row.session_id as string) === user.id;
    if (!isAuthor) {
      const ctx = await channelContext(env, channelId, user.id);
      if (ctx.isDm || !ctx.member || !ctx.role || !hasCapability(ctx.role, "MANAGE_MESSAGES", ctx.overrides))
        return json({ error: "forbidden" }, 403, env);
    }
    const { text } = await readJson<{ text?: string }>(request);
    const nextText = String(text || "").trim().slice(0, MAX_TEXT_LEN);
    if (!nextText) return json({ error: "empty_message" }, 400, env);
    const previousText = (row.text as string) || "";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO message_edits (id, message_id, previous_text, edited_by, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(genId(), msgMatch[1], previousText.slice(0, MAX_TEXT_LEN), user.id, now()),
      env.DB.prepare(`UPDATE ${isDm ? "dm_messages" : "messages"} SET text = ?, edited = 1, edited_at = ? WHERE id = ?`)
        .bind(nextText, now(), msgMatch[1]),
    ]);
    return json({ ok: true }, 200, env);
  }

  if (msgMatch && method === "DELETE") {
    const row =
      (await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(msgMatch[1]).first<Record<string, unknown>>()) ||
      (await env.DB.prepare("SELECT * FROM dm_messages WHERE id = ?").bind(msgMatch[1]).first<Record<string, unknown>>());
    if (!row) return json({ error: "not_found" }, 404, env);
    const isDm = !row.channel_id;
    const channelId = (row.channel_id as string) || (row.dm_channel_id as string);
    const isAuthor =
      (row.author_id as string) === user.id ||
      ((row.author_id as string) || "") === "" && (row.session_id as string) === user.id;
    if (!isAuthor) {
      const ctx = await channelContext(env, channelId, user.id);
      if (ctx.isDm || !ctx.member || !ctx.role || !hasCapability(ctx.role, "MANAGE_MESSAGES", ctx.overrides))
        return json({ error: "forbidden" }, 403, env);
    }
    // Tombstone: keep the row for moderation/audit, hide from fetch.
    const table = isDm ? "dm_messages" : "messages";
    const col = isDm ? "dm_channel_id" : "channel_id";
    await env.DB.batch([
      env.DB.prepare(`UPDATE ${table} SET deleted = 1, file_url = NULL WHERE id = ? OR (thread_id = ? AND deleted = 0)`)
        .bind(msgMatch[1], msgMatch[1]),
      env.DB.prepare(`DELETE FROM ${table} WHERE ${col} = ? AND deleted = 1 AND timestamp < ?`)
        .bind(channelId, new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);
    return json({ ok: true }, 200, env);
  }

  const threadMatch = p.match(/^\/threads\/([^/]+)$/);
  if (threadMatch && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM messages WHERE thread_id = ? AND deleted = 0 ORDER BY timestamp ASC LIMIT 200"
    )
      .bind(threadMatch[1])
      .all<Record<string, unknown>>();
    return json({ messages: (results || []).map(mapMessage) }, 200, env);
  }

  const pinMatch = p.match(/^\/messages\/([^/]+)\/pin$/);
  if (pinMatch && method === "POST") {
    const row = await env.DB.prepare("SELECT * FROM messages WHERE id = ?")
      .bind(pinMatch[1])
      .first<Record<string, unknown>>();
    if (!row) return json({ error: "not_found" }, 404, env);
    const ctx = await channelContext(env, row.channel_id as string, user.id);
    if (ctx.isDm || !ctx.member || !ctx.role || !hasCapability(ctx.role, "PIN_MESSAGES", ctx.overrides))
      return json({ error: "forbidden" }, 403, env);
    const pinned = Boolean(row.pinned);
    await env.DB.prepare("UPDATE messages SET pinned = ?, pinned_at = ? WHERE id = ?")
      .bind(pinned ? 0 : 1, pinned ? null : now(), pinMatch[1])
      .run();
    await logAudit(env, {
      serverId: ctx.serverId || "",
      actorId: user.id,
      actorName: user.fullName,
      action: pinned ? "message_unpin" : "message_pin",
      targetType: "message",
      targetId: pinMatch[1],
    });
    return json({ ok: true }, 200, env);
  }

  const reactMatch = p.match(/^\/messages\/([^/]+)\/reactions$/);
  if (reactMatch && method === "PUT") {
    const row =
      (await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(reactMatch[1]).first<Record<string, unknown>>()) ||
      (await env.DB.prepare("SELECT * FROM dm_messages WHERE id = ?").bind(reactMatch[1]).first<Record<string, unknown>>());
    if (!row) return json({ error: "not_found" }, 404, env);
    const isDm = !row.channel_id;
    const channelId = (row.channel_id as string) || (row.dm_channel_id as string);
    const ctx = await channelContext(env, channelId, user.id);
    if (ctx.isDm) {
      if (!ctx.isParticipant) return json({ error: "not_a_participant" }, 403, env);
    } else if (!ctx.member || (ctx.role && !hasCapability(ctx.role, "ADD_REACTIONS", ctx.overrides))) {
      return json({ error: "forbidden" }, 403, env);
    }
    const { reactions } = await readJson<{ reactions?: Record<string, string[]> }>(request);
    // Validate shape defensively.
    const clean: Record<string, string[]> = {};
    if (reactions && typeof reactions === "object") {
      for (const [emoji, users] of Object.entries(reactions).slice(0, 40)) {
        if (emoji.length > 32) continue;
        if (Array.isArray(users)) {
          clean[emoji] = users.filter((u) => typeof u === "string" && u.length <= 80).slice(0, 200);
        }
      }
    }
    const previous = parseJson<Record<string, string[]>>(row.reactions as string, {});
    const prevCount = Object.values(previous).reduce((n, u) => n + u.length, 0);
    const nextCount = Object.values(clean).reduce((n, u) => n + u.length, 0);
    await env.DB.prepare(`UPDATE ${isDm ? "dm_messages" : "messages"} SET reactions = ? WHERE id = ?`)
      .bind(stringifyJson(clean), reactMatch[1])
      .run();
    // Notify the author when someone else adds a reaction (avoid spam: only on +1).
    const authorId = row.author_id as string;
    if (nextCount > prevCount && authorId && authorId !== user.id) {
      const emojiAdded = Object.entries(clean).find(
        ([emoji, users]) => users.length > (previous[emoji]?.length || 0)
      );
      await createNotification(env, {
        targetUserId: authorId,
        type: "reaction",
        title: `${user.fullName || "Someone"} reacted with ${emojiAdded?.[0] || "👍"}`,
        data: { channelId, messageId: reactMatch[1] },
      });
    }
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
    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
      .bind(participantId)
      .first();
    if (!target) return json({ error: "user_not_found" }, 404, env);
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
      .bind(id, channelId, user.id, String(displayName || user.fullName).slice(0, 80), user.id, now())
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
      .bind(genId(), user.id, String(displayName || user.fullName).slice(0, 80), String(color || "#8B5CF6").slice(0, 20), now(), now())
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
    const name = String(body.name || user.fullName || "").trim().slice(0, 80);
    await env.DB.prepare(
      `INSERT INTO profiles (id, session_id, name, avatar, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar,
         color = excluded.color, updated_at = excluded.updated_at`
    )
      .bind(genId(), user.id, name, String(body.avatar || "").slice(0, 2000), String(body.color || "#8B5CF6").slice(0, 20), ts, ts)
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
    // Cap award amounts — the server decides XP, not the client.
    const amt = Math.max(0, Math.min(Math.round(Number(amount) || 0), 100));
    const why = ["message", "reaction", "reply", "call", "event"].includes(reason || "") ? reason : "message";
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
    const newXp = ((row.xp as number) || 0) + amt;
    const level = Math.floor(Math.sqrt(newXp / 100)) + 1;
    let streak = (row.streak_count as number) || 0;
    let msgs = (row.messages_sent as number) || 0;
    let reacts = (row.reactions_received as number) || 0;
    let replies = (row.replies_received as number) || 0;
    if (why === "message") {
      msgs += 1;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      streak = (row.last_message_date as string) === yesterday ? streak + 1 : (row.last_message_date as string) === today ? streak : 1;
    }
    if (why === "reaction") reacts += 1;
    if (why === "reply") replies += 1;
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
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
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
        String(body.callerName || "").slice(0, 80),
        String(body.calleeName || "").slice(0, 80),
        body.video ? 1 : 0,
        String(body.status || "ringing").slice(0, 20),
        String(body.startedAt || now()).slice(0, 64),
        body.endedAt ? String(body.endedAt).slice(0, 64) : null,
        typeof body.durationMs === "number" ? body.durationMs : null,
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
    const title = String(body.title || "").trim().slice(0, MAX_TITLE_LEN);
    const postBody = String(body.body || "").trim().slice(0, MAX_BODY_LEN);
    if (!title) return json({ error: "title_required" }, 400, env);
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO board_posts (id, title, body, category, author_id, author_name, author_avatar, author_color, vote_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
      .bind(
        id,
        title,
        postBody,
        String(body.category || "general").slice(0, 50),
        user.id,
        user.fullName,
        String(body.authorAvatar || "").slice(0, 2000),
        String(body.authorColor || "#a078ff").slice(0, 20),
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
    const dndStart = /^\d{2}:\d{2}$/.test(String(body.dndStart || "")) ? String(body.dndStart) : "22:00";
    const dndEnd = /^\d{2}:\d{2}$/.test(String(body.dndEnd || "")) ? String(body.dndEnd) : "08:00";
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
        String(body.messageSound || "Pop").slice(0, 50),
        String(body.callRingtone || "Classic").slice(0, 50),
        body.dndEnabled ? 1 : 0,
        stringifyJson(Array.isArray(body.dndDays) ? body.dndDays.filter((d) => typeof d === "string").slice(0, 7) : []),
        dndStart,
        dndEnd,
        now()
      )
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── Notifications queue (push delivery) ──
  if (p === "/notifications/queue" && method === "POST") {
    const body = await readJson<{ userId?: string; title?: string; body?: string; data?: Record<string, unknown> }>(request);
    if (!body.userId || !body.title) return json({ error: "userId and title are required" }, 400, env);
    await env.DB.prepare(
      "INSERT INTO notifications (id, target_user_id, title, body, data, sent, read, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)"
    )
      .bind(genId(), body.userId, String(body.title).slice(0, 300), String(body.body || "").slice(0, 300), stringifyJson(body.data || {}), now())
      .run();
    return json({ ok: true }, 200, env);
  }

  // ── External feeds ──
  if (p === "/feed" && method === "GET") {
    const source = url.searchParams.get("source");
    const tag = url.searchParams.get("tag");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    let sql = "SELECT * FROM feed_posts";
    const binds: unknown[] = [];
    const where: string[] = [];
    if (source) {
      where.push("source = ?");
      binds.push(source);
    }
    if (tag) {
      where.push("tags LIKE ?");
      binds.push(`%\"${String(tag).replace(/[^a-z0-9-]/gi, "")}\"%`);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY published_at DESC LIMIT ? OFFSET ?";
    binds.push(limit, offset);
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return json((results || []).map(mapFeedPost), 200, env);
  }
  if (p === "/feed/refresh" && method === "POST") {
    // Manual refresh — same cooldowns as the cron, so this is safe to call.
    const result = await refreshFeed(env);
    return json(result, 200, env);
  }

  // ── Auth / me endpoints handled by the router ──
  return null;
}

/** Serve an uploaded file. Called from the router BEFORE the auth gate so
 *  images/files are publicly readable (browsers don't send Authorization).
 *  Active content is defanged: nosniff + a null CSP sandbox means even if a
 *  malicious file slips through the upload allowlist it cannot execute. */
export async function serveAsset(env: Env, key: string): Promise<Response | null> {
  const { value, metadata } = await env.ASSETS.getWithMetadata(key, { type: "arrayBuffer" });
  if (value === null) return null;
  const meta = (metadata || {}) as { contentType?: string };
  const headers = new Headers();
  headers.set("Content-Type", meta.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", env.CORS_ORIGIN || "*");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
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
export type { Capability };
