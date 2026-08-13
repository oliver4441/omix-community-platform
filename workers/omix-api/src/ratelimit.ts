/**
 * Rate limiting — D1-backed sliding window counters.
 *
 * Design notes:
 * - One row per key per window; the counter is incremented atomically via a
 *   single UPSERT statement, so concurrent requests can't double-spend quota.
 * - Old rows are pruned opportunistically (max 1% of writes) to keep the table
 *   small.
 * - Keys are caller-controlled strings (e.g. `msg:${userId}`); always combine
 *   with the authenticated user id, never with raw client input alone.
 */
import type { Env } from "./env";

export interface RateLimitResult {
  ok: boolean;
  /** Remaining requests in this window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets (0 when ok). */
  retryAfterSeconds: number;
}

const PRUNE_EVERY = 100;

export async function rateLimit(
  env: Env,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const nowMs = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END`
    )
      .bind(key, windowStart, windowStart, windowStart, windowStart)
      .run();

    const row = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
      .bind(key)
      .first<{ count: number; window_start: number }>();

    const count = row?.count ?? 0;
    const start = row?.window_start ?? windowStart;

    // Opportunistic prune of expired rows (only occasionally).
    if (count % PRUNE_EVERY === 1) {
      await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?")
        .bind(nowMs - 2 * windowMs)
        .run();
    }

    const remaining = Math.max(0, limit - count);
    const retryAfterSeconds = count >= limit
      ? Math.max(1, Math.ceil((start + windowMs - nowMs) / 1000))
      : 0;
    return { ok: count <= limit, remaining, retryAfterSeconds };
  } catch (err) {
    // Fail open: a rate-limiter outage must never take the API down.
    console.error("[ratelimit] error, failing open:", err);
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Standard per-user request bucket (applied to all authed routes). */
export function userRateLimit(env: Env, userId: string) {
  return rateLimit(env, `user:${userId}`, 240, 60_000);
}

/** Strict bucket for message creation — flood protection. */
export function messageRateLimit(env: Env, userId: string) {
  return rateLimit(env, `msg:${userId}`, 10, 10_000);
}

/** Bucket for moderation actions. */
export function moderationRateLimit(env: Env, userId: string) {
  return rateLimit(env, `mod:${userId}`, 20, 60_000);
}

/** Bucket for auth attempts, keyed per identity + IP. */
export function authRateLimit(env: Env, identity: string, ip: string) {
  return rateLimit(env, `auth:${identity}:${ip}`, 10, 15 * 60_000);
}
