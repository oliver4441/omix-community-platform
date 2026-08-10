/**
 * notifications — per-user notification settings and web-push subscriptions.
 *
 * Extracted from the former crud.ts monolith. The actual push crypto/delivery
 * lives in push.ts; this module owns the HTTP surface for them.
 */
import type { Env } from "../../shared/env";
import {
  json,
  readJson,
  now,
  parseJson,
  stringifyJson,
  type SessionUser,
} from "../../shared/util";
import { saveSubscription, deleteSubscription, deliverPending } from "../../shared/push";

export async function handleNotifications(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const p = new URL(request.url).pathname;
  const method = request.method;

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

  // ── Web push subscriptions + manual delivery ──
  if (p === "/push/subscription" && method === "PUT") {
    const body = await readJson<{ endpoint?: string; p256dh?: string; auth?: string; userAgent?: string }>(request);
    try {
      await saveSubscription(env, user.id, body);
    } catch {
      return json({ error: "invalid_subscription" }, 400, env);
    }
    return json({ ok: true }, 200, env);
  }
  if (p === "/push/subscription" && method === "DELETE") {
    const body = await readJson<{ endpoint?: string }>(request);
    if (!body.endpoint) return json({ error: "endpoint_required" }, 400, env);
    await deleteSubscription(env, body.endpoint);
    return json({ ok: true }, 200, env);
  }
  if (p === "/push/send" && method === "POST") {
    // Manual delivery trigger (also run every 5 min by omix-cron).
    const result = await deliverPending(env);
    return json(result, 200, env);
  }

  return null;
}
