/**
 * config — app-wide settings and admin endpoints.
 *
 * Extracted from the former crud.ts monolith.
 */
import type { Env } from "../../shared/env";
import {
  json,
  readJson,
  now,
  getAdminSettings,
  stringifyJson,
  type SessionUser,
} from "../../shared/util";

export async function handleConfig(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const p = new URL(request.url).pathname;
  const method = request.method;

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

  return null;
}
