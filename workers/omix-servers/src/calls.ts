/**
 * calls — call log persistence (voice/video call history).
 *
 * Extracted from the former crud.ts monolith.
 */
import type { Env } from "../../shared/env";
import { json, readJson, now, genId, type SessionUser } from "../../shared/util";

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

export async function handleCalls(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

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

  return null;
}
