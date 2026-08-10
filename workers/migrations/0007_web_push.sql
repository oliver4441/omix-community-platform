-- ════════════════════════════════════════════════════════════════
-- 0007 — VAPID web push (replaces the dead FCM wiring)
--
-- push_subscriptions: browser PushSubscription rows (endpoint + keys)
-- registered per user via PUT /push/subscription. The worker sends
-- RFC 8291 ("aes128gcm") encrypted payloads straight to the browser
-- push service — no FCM account needed.
--
-- fcm_tokens was never written (the client's saveFCMToken() was a
-- stub) and is now dropped.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Delivery bookkeeping: retry counter so a flaky push service doesn't
-- cause an infinite retry loop in omix-cron.
ALTER TABLE notifications ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

DROP TABLE IF EXISTS fcm_tokens;
