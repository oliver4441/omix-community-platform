-- ════════════════════════════════════════════════════════════════
-- 0006 — dm_messages parity with messages
--
-- The shared insertMessage()/getMessages() paths in crud.ts write and
-- filter the same columns for DM and channel messages, but dm_messages
-- was created without the thread/pin/mention columns — so every DM send
-- and DM load hit "no such column" and failed.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE dm_messages ADD COLUMN pinned     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dm_messages ADD COLUMN pinned_at  TEXT;
ALTER TABLE dm_messages ADD COLUMN thread_id  TEXT;
ALTER TABLE dm_messages ADD COLUMN mentions   TEXT;

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON dm_messages(thread_id);
