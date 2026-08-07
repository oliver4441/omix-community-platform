-- ════════════════════════════════════════════════════════════════
-- feed_posts — aggregated developer-news feed (HN, Reddit, GitHub,
-- Product Hunt). Populated by omix-cron (and POST /feed/refresh).
-- Dedupe: (source, external_id) unique + normalized-title hash.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feed_posts (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,                -- 'hn' | 'reddit' | 'github' | 'producthunt'
  external_id   TEXT NOT NULL,
  source_url    TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  category      TEXT NOT NULL DEFAULT '',     -- subreddit / language / 'Hacker News'
  thumbnail     TEXT NOT NULL DEFAULT '',
  image_url     TEXT NOT NULL DEFAULT '',
  author        TEXT NOT NULL DEFAULT '',
  score         INTEGER NOT NULL DEFAULT 0,
  num_comments  INTEGER NOT NULL DEFAULT 0,
  comments      TEXT NOT NULL DEFAULT '[]',   -- JSON [{author, text}]
  related_repos TEXT NOT NULL DEFAULT '[]',   -- JSON [{name, url, stars}]
  title_key     TEXT NOT NULL DEFAULT '',     -- sha1 of normalized title (cross-source dedupe)
  published_at  TEXT NOT NULL,
  fetched_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_posts_source_ext ON feed_posts(source, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_posts_title_key ON feed_posts(title_key);
CREATE INDEX IF NOT EXISTS idx_feed_posts_published ON feed_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_source ON feed_posts(source);
