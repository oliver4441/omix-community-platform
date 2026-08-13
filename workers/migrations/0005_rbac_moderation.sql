-- ════════════════════════════════════════════════════════════════
-- omix-db migration 0005 — RBAC, moderation, search, notifications, events
-- P0 production-upgrade layer. Additive: existing rows/tables untouched.
-- ════════════════════════════════════════════════════════════════

-- ── RBAC additions on memberships ──
ALTER TABLE server_members ADD COLUMN muted_until TEXT;
ALTER TABLE server_members ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;

-- ── Message tombstones (deletions keep history) ──
ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dm_messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

-- ── Idempotency nonce (offline outbox replays) ──
ALTER TABLE messages ADD COLUMN nonce TEXT;
ALTER TABLE dm_messages ADD COLUMN nonce TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_nonce ON messages(nonce);

-- ── Edit history (per-message, for "edited" tooltips + audit) ──
CREATE TABLE IF NOT EXISTS message_edits (
  id            TEXT PRIMARY KEY,
  message_id    TEXT NOT NULL,
  previous_text TEXT NOT NULL DEFAULT '',
  edited_by     TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_message_edits_message ON message_edits(message_id);

-- ── Moderation ──
CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  server_id    TEXT NOT NULL,
  reporter_id  TEXT NOT NULL,
  target_type  TEXT NOT NULL,               -- 'message' | 'user' | 'thread'
  target_id    TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open',-- 'open' | 'resolved' | 'dismissed'
  handled_by   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_server ON reports(server_id);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id            TEXT PRIMARY KEY,
  server_id     TEXT NOT NULL,
  actor_id      TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  action        TEXT NOT NULL,              -- warn | mute | unmute | timeout | kick | ban | unban
  reason        TEXT NOT NULL DEFAULT '',
  expires_at    TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moderation_server ON moderation_actions(server_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_target ON moderation_actions(target_user_id);

-- ── Audit log ──
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  server_id   TEXT NOT NULL DEFAULT '',
  actor_id    TEXT NOT NULL,
  actor_name  TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,                -- snake_case verb, e.g. member_ban
  target_type TEXT NOT NULL DEFAULT '',
  target_id   TEXT NOT NULL DEFAULT '',
  reason      TEXT NOT NULL DEFAULT '',
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_server ON audit_log(server_id, created_at);

-- ── Rate limiting (sliding window counters) ──
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ── Community events ──
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  server_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at   TEXT NOT NULL,
  ends_at     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  location    TEXT NOT NULL DEFAULT '',
  host_id     TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_server ON events(server_id, starts_at);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'going', -- going | maybe | declined
  created_at TEXT NOT NULL,
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id);

-- ── Notification reads (center) ──
ALTER TABLE notifications ADD COLUMN read INTEGER NOT NULL DEFAULT 0;

-- ── Per-channel/thread notification overrides ──
CREATE TABLE IF NOT EXISTS notification_overrides (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'channel', -- channel | thread
  target_id   TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'default', -- default | all | mentions | muted
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, scope, target_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_overrides_user ON notification_overrides(user_id);

-- ── Channel permission overrides (capability deltas per role/member) ──
CREATE TABLE IF NOT EXISTS channel_permission_overrides (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'role',   -- role | member
  scope_id    TEXT NOT NULL,                  -- role name or user id
  allow       TEXT NOT NULL DEFAULT '[]',
  deny        TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  UNIQUE (channel_id, scope, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_overrides_channel ON channel_permission_overrides(channel_id);
