-- ════════════════════════════════════════════════════════════════
-- snippets — community code snippet library. Anyone can publish a
-- snippet; snippets are voted on (up only, like board posts) so the
-- best ones float to the top.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS snippets (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  language      TEXT NOT NULL DEFAULT 'text',
  code          TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '[]',
  author_id     TEXT NOT NULL,
  author_name   TEXT NOT NULL DEFAULT '',
  author_color  TEXT NOT NULL DEFAULT '#a078ff',
  vote_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);
CREATE INDEX IF NOT EXISTS idx_snippets_created ON snippets(created_at);
CREATE INDEX IF NOT EXISTS idx_snippets_author ON snippets(author_id);

CREATE TABLE IF NOT EXISTS snippet_votes (
  snippet_id  TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (snippet_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_snippet_votes_session ON snippet_votes(session_id);
