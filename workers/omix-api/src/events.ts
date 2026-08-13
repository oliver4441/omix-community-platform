/**
 * Community events — create/list/detail + RSVP.
 * (P1 UI lands later; the API is here so search + notifications can use it.)
 */
import type { Env } from "./env";
import { json, readJson, now, genId } from "./util";
import type { SessionUser } from "./util";
import { requireMembership, can } from "./moderation";
import { createNotification } from "./notifications";

const TZ_RE = /^[A-Za-z_+-][A-Za-z0-9_+./-]{0,60}$/;

export async function handleEvents(
  env: Env,
  request: Request,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  const listMatch = p.match(/^\/servers\/([^/]+)\/events$/);
  if (listMatch && method === "GET") {
    const member = await requireMembership(env, listMatch[1], user.id);
    if (!member) return json({ error: "not_a_member" }, 403, env);
    const upcoming = url.searchParams.get("upcoming") === "1";
    const sql = upcoming
      ? "SELECT * FROM events WHERE server_id = ? AND starts_at >= ? ORDER BY starts_at ASC LIMIT 100"
      : "SELECT * FROM events WHERE server_id = ? ORDER BY starts_at DESC LIMIT 100";
    const binds: unknown[] = upcoming
      ? [listMatch[1], now()]
      : [listMatch[1]];
    const { results } = await env.DB.prepare(sql)
      .bind(...binds)
      .all<Record<string, unknown>>();
    return json(
      (results || []).map((e) => ({
        id: e.id,
        serverId: e.server_id,
        title: e.title,
        description: e.description,
        startsAt: e.starts_at,
        endsAt: (e.ends_at as string) || null,
        timezone: e.timezone,
        location: e.location,
        hostId: e.host_id,
        createdAt: e.created_at,
      })),
      200,
      env
    );
  }

  if (listMatch && method === "POST") {
    const member = await requireMembership(env, listMatch[1], user.id);
    if (!member || !can(env, member, "MANAGE_EVENTS"))
      return json({ error: "forbidden" }, 403, env);
    const body = await readJson<{
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      timezone?: string;
      location?: string;
    }>(request);
    if (!body.title || !body.title.trim())
      return json({ error: "title_required" }, 400, env);
    if (!body.startsAt || Number.isNaN(Date.parse(body.startsAt)))
      return json({ error: "invalid_starts_at" }, 400, env);
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO events (id, server_id, title, description, starts_at, ends_at, timezone, location, host_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        listMatch[1],
        body.title.trim().slice(0, 200),
        (body.description || "").slice(0, 4000),
        body.startsAt,
        body.endsAt || null,
        TZ_RE.test(body.timezone || "") ? body.timezone : "UTC",
        (body.location || "").slice(0, 300),
        user.id,
        user.id,
        now()
      )
      .run();
    return json({ id }, 200, env);
  }

  const rsvpMatch = p.match(/^\/events\/([^/]+)\/rsvp$/);
  if (rsvpMatch && method === "PUT") {
    const { status } = await readJson<{ status?: string }>(request);
    if (!["going", "maybe", "declined"].includes(status || ""))
      return json({ error: "invalid_status" }, 400, env);
    const event = await env.DB.prepare("SELECT * FROM events WHERE id = ?")
      .bind(rsvpMatch[1])
      .first<Record<string, unknown>>();
    if (!event) return json({ error: "not_found" }, 404, env);
    const member = await requireMembership(env, event.server_id as string, user.id);
    if (!member) return json({ error: "not_a_member" }, 403, env);
    await env.DB.prepare(
      `INSERT INTO event_rsvps (id, event_id, user_id, status, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`
    )
      .bind(genId(), rsvpMatch[1], user.id, status, now())
      .run();
    return json({ ok: true }, 200, env);
  }

  const rsvpsMatch = p.match(/^\/events\/([^/]+)\/rsvps$/);
  if (rsvpsMatch && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM event_rsvps WHERE event_id = ?"
    )
      .bind(rsvpsMatch[1])
      .all<Record<string, unknown>>();
    return json(
      (results || []).map((r) => ({
        userId: r.user_id,
        status: r.status,
        createdAt: r.created_at,
      })),
      200,
      env
    );
  }

  return null;
}

/** Notify an event's RSVPs (used by reminders in omix-cron). */
export async function notifyEventAttendees(
  env: Env,
  eventId: string,
  title: string,
  body: string
): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT user_id FROM event_rsvps WHERE event_id = ? AND status != 'declined'"
  )
    .bind(eventId)
    .all<{ user_id: string }>();
  for (const row of results || []) {
    await createNotification(env, {
      targetUserId: row.user_id,
      type: "event",
      title,
      body,
      data: { eventId },
    });
  }
}
