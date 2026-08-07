-- ════════════════════════════════════════════════════════════════
-- github_tokens — persisted GitHub OAuth access tokens (per user).
-- Stored at OAuth callback time so the profile can list the user's
-- repositories (public + private when the repo scope was granted).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS github_tokens (
  user_id      TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_github_tokens_user ON github_tokens(user_id);
