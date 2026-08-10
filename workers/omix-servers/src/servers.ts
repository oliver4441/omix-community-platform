/**
 * servers — servers, channels and invites.
 *
 * Extracted from the former crud.ts monolith.
 */
import type { Env } from "../../shared/env";
import {
  json,
  readJson,
  now,
  genId,
  genToken,
  type SessionUser,
} from "../../shared/util";

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

// ═══════════ handler ═══════════

export async function handleServers(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

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

  return null;
}
