/**
 * Feed ingestion — aggregates developer-news from HN, Reddit, GitHub and
 * Product Hunt into the D1 `feed_posts` table.
 *
 * Shared by omix-cron (scheduled) and omix-api (POST /feed/refresh).
 * All sources are free/keyless by default; GitHub optional basic auth and
 * the Product Hunt token are used only when the env vars are present.
 *
 * Dedupe: INSERT OR IGNORE against the (source, external_id) and title_key
 * unique indexes, so repeated runs never duplicate topics.
 */

export interface FeedEnv {
  DB: D1Database;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  PRODUCTHUNT_API_TOKEN?: string;
}

export interface FeedPostInput {
  source: "hn" | "reddit" | "github" | "devto" | "producthunt";
  externalId: string;
  sourceUrl: string;
  title: string;
  summary?: string;
  tags?: string[];
  category?: string;
  thumbnail?: string;
  imageUrl?: string;
  author?: string;
  score?: number;
  numComments?: number;
  comments?: { author: string; text: string }[];
  relatedRepos?: { name: string; url: string; stars: number }[];
  publishedAt: string;
}

interface FeedState {
  last: Record<string, string>;
}

const SOURCES: FeedPostInput["source"][] = ["hn", "reddit", "devto", "github", "producthunt"];

/** Don't re-fetch a source more often than this (respects rate limits). */
const COOLDOWN_MS = 25 * 60 * 1000;

// ── tiny helpers ──

function hashKey(s: string): string {
  // FNV-1a 32-bit — deterministic, sync (Web Crypto is async).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

async function fetchJson(url: string, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "omix-community/1.0 (dev feed aggregator)", ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Best-effort og: metadata (title/image/description) from an article page. */
async function ogPreview(url: string): Promise<{ title?: string; image?: string; description?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; omix-feed/1.0)" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return {};
    const html = (await res.text()).slice(0, 200_000);
    const pick = (prop: string): string | undefined => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"));
      if (m) return m[1];
      const m2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
      return m2 ? m2[1] : undefined;
    };
    return {
      title: pick("og:title") || pick("twitter:title"),
      image: pick("og:image") || pick("twitter:image"),
      description: pick("og:description") || pick("twitter:description"),
    };
  } catch {
    return {};
  }
}

function genId(): string {
  return crypto.randomUUID();
}

// ── per-source fetchers ──

async function fetchHN(env: FeedEnv): Promise<FeedPostInput[]> {
  const ids = (await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json")) as number[];
  const items = (
    await Promise.all(
      ids.slice(0, 30).map(async (id) => {
        try {
          return (await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)) as {
            id: number; title?: string; url?: string; text?: string;
            by?: string; score?: number; descendants?: number; time?: number; kids?: number[];
          };
        } catch {
          return null;
        }
      })
    )
  ).filter((x): x is NonNullable<typeof x> => Boolean(x && x.title));

  // Parallelize per-item enrichment (og previews + comment snippets) so the
  // whole refresh stays well under the worker's 30s wall-clock budget.
  const enriched = await Promise.all(
    items.slice(0, 12).map(async (item) => {
      const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
      const summaryText = stripHtml(item.text || "").slice(0, 240);
      const domain = item.url ? new URL(item.url).hostname.replace(/^www\./, "") : "news.ycombinator.com";
      const [preview, commentRows] = await Promise.all([
        item.url ? ogPreview(item.url) : Promise.resolve({} as { title?: string; image?: string; description?: string }),
        Promise.all(
          (item.kids || []).slice(0, 3).map(async (kid): Promise<{ author: string; text: string } | null> => {
            try {
              const c = (await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${kid}.json`)) as {
                by?: string; text?: string;
              };
              const text = truncate(stripHtml(c.text || ""), 160);
              return c.by && text ? { author: c.by, text } : null;
            } catch {
              return null;
            }
          })
        ),
      ]);
      const comments = commentRows.filter((c): c is { author: string; text: string } => Boolean(c));
      return { item, url, domain, summaryText, preview, comments };
    })
  );

  const out: FeedPostInput[] = [];
  for (const { item, url, domain, summaryText, preview, comments } of enriched) {
    out.push({
      source: "hn",
      externalId: String(item.id),
      sourceUrl: url,
      title: item.title || "Untitled",
      summary: preview.description || summaryText || `Discussion on Hacker News (${domain}).`,
      tags: ["hacker news", "hn", domain],
      category: "Hacker News",
      thumbnail: preview.image || "",
      imageUrl: preview.image || "",
      author: item.by || "",
      score: item.score || 0,
      numComments: item.descendants || 0,
      comments,
      publishedAt: new Date((item.time || Date.now() / 1000) * 1000).toISOString(),
    });
  }
  return out;
}

const DEV_SUBREDDITS = ["programming", "javascript", "reactjs", "webdev", "rust", "golang", "python", "MachineLearning"];

async function fetchReddit(env: FeedEnv): Promise<FeedPostInput[]> {
  const out: FeedPostInput[] = [];
  const allChildren = await Promise.all(
    DEV_SUBREDDITS.map(async (sub) => {
      try {
        const data = (await fetchJson(
          `https://www.reddit.com/r/${sub}/top.json?limit=8&t=day`,
          { Accept: "application/json" }
        )) as { data?: { children?: { data: Record<string, unknown> }[] } };
        return { sub, children: data.data?.children || [] };
      } catch {
        return { sub, children: [] as { data: Record<string, unknown> }[] };
      }
    })
  );
  for (const { sub, children } of allChildren) {
    for (const child of children) {
      const d = child.data;
      const title = String(d.title || "").trim();
      if (!title) continue;
      const isSelf = Boolean(d.is_self);
      const externalUrl = isSelf ? `https://www.reddit.com${d.permalink}` : String(d.url || "");
      const thumb = typeof d.thumbnail === "string" && /^https?:/.test(d.thumbnail) ? d.thumbnail : "";
      const summary = truncate(stripHtml(String(d.selftext || "")).slice(0, 240), 260) ||
        `Top post on r/${sub}.`;
      out.push({
        source: "reddit",
        externalId: String(d.id || `${sub}-${title.slice(0, 40)}`),
        sourceUrl: externalUrl,
        title,
        summary,
        tags: ["reddit", sub.toLowerCase()],
        category: `r/${sub}`,
        thumbnail: thumb,
        imageUrl: thumb,
        author: String(d.author || ""),
        score: Number(d.score) || 0,
        numComments: Number(d.num_comments) || 0,
        publishedAt: new Date(Number(d.created_utc) * 1000).toISOString(),
      });
    }
  }
  return out;
}

async function fetchDevto(env: FeedEnv): Promise<FeedPostInput[]> {
  // Free, keyless, worker-friendly — the reliable "developer discussions"
  // source (Reddit blocks datacenter IPs, so this is the workhorse).
  try {
    const data = (await fetchJson("https://dev.to/api/articles?top=30&per_page=12")) as {
      id?: number; title?: string; description?: string; url?: string; tags?: string;
      user?: { name?: string; profile_image_90?: string };
      positive_reactions_count?: number; comments_count?: number;
      published_at?: string; social_image?: string;
    }[];
    const out: FeedPostInput[] = [];
    for (const a of (data || []).slice(0, 12)) {
      if (!a.title) continue;
      const tagList = String(a.tags || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      out.push({
        source: "devto",
        externalId: `devto:${a.id}`,
        sourceUrl: String(a.url || ""),
        title: String(a.title),
        summary: truncate(String(a.description || ""), 240),
        tags: ["dev.to", ...tagList],
        category: "Dev.to",
        thumbnail: String(a.social_image || a.user?.profile_image_90 || ""),
        imageUrl: String(a.social_image || ""),
        author: String(a.user?.name || ""),
        score: Number(a.positive_reactions_count) || 0,
        numComments: Number(a.comments_count) || 0,
        publishedAt: String(a.published_at || new Date().toISOString()),
      });
    }
    return out;
  } catch {
    return [];
  }
}

const TRENDING_REPOS = [
  "facebook/react", "vercel/next.js", "vitejs/vite", "rust-lang/rust",
  "sveltejs/svelte", "microsoft/vscode", "denoland/deno", "tauri-apps/tauri",
];

async function fetchGithub(env: FeedEnv): Promise<FeedPostInput[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    // Basic auth with an OAuth app raises the 60/hr limit to 5,000/hr.
    headers.Authorization = `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`;
  }
  const out: FeedPostInput[] = [];

  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const data = (await fetchJson(
      `https://api.github.com/search/repositories?q=created:%3E${weekAgo}&sort=stars&order=desc&per_page=12`,
      headers
    )) as { items?: Record<string, unknown>[] };
    for (const r of (data.items || []).slice(0, 10)) {
      const owner = r.owner as { avatar_url?: string; login?: string } | undefined;
      out.push({
        source: "github",
        externalId: `repo:${r.full_name}`,
        sourceUrl: String(r.html_url || ""),
        title: String(r.full_name || ""),
        summary: truncate(String(r.description || "Trending open-source repository on GitHub."), 240),
        tags: ["github", "open source", ...(String(r.language || "").toLowerCase() ? [String(r.language).toLowerCase()] : [])],
        category: String(r.language || "GitHub"),
        thumbnail: String(owner?.avatar_url || ""),
        imageUrl: String(owner?.avatar_url || ""),
        author: String(owner?.login || ""),
        score: Number(r.stargazers_count) || 0,
        relatedRepos: [{ name: String(r.full_name), url: String(r.html_url), stars: Number(r.stargazers_count) || 0 }],
        publishedAt: String(r.created_at || new Date().toISOString()),
      });
    }
  } catch { /* search rate-limited */ }

  try {
    const releases = await Promise.all(
      TRENDING_REPOS.map(async (repo) => {
        try {
          const rel = (await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, headers)) as {
            tag_name?: string; name?: string; html_url?: string; published_at?: string;
            body?: string; author?: { login?: string };
          };
          return { repo, rel };
        } catch {
          return null; /* repo may have no latest release */
        }
      })
    );
    for (const entry of releases) {
      const rel = entry?.rel;
      if (!entry || !rel?.tag_name) continue;
      const repo = entry.repo;
      const tag = String(rel.tag_name);
      out.push({
        source: "github",
        externalId: `release:${repo}:${tag}`,
        sourceUrl: String(rel.html_url || `https://github.com/${repo}/releases/tag/${tag}`),
        title: `${repo} — ${rel.name || tag}`,
        summary: truncate(stripHtml(rel.body || "New release."), 240),
        tags: ["github", "release", repo.split("/")[1]],
        category: "Release",
        thumbnail: `https://github.com/${repo.split("/")[0]}.png?size=64`,
        author: String(rel.author?.login || ""),
        publishedAt: String(rel.published_at || new Date().toISOString()),
      });
    }
  } catch { /* skip releases */ }

  return out;
}

async function fetchProductHunt(env: FeedEnv): Promise<FeedPostInput[]> {
  if (!env.PRODUCTHUNT_API_TOKEN) return [];
  try {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PRODUCTHUNT_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `{ posts(first: 10, order: RANKING) { edges { node {
          id name tagline url votesCount commentsCount createdAt
          thumbnail { url }
        } } } }`,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { posts?: { edges?: { node: Record<string, unknown> }[] } } };
    return (json.data?.posts?.edges || []).map(({ node }) => ({
      source: "producthunt" as const,
      externalId: `ph:${node.id}`,
      sourceUrl: String(node.url || ""),
      title: String(node.name || ""),
      summary: truncate(String(node.tagline || ""), 240),
      tags: ["product hunt", "tools"],
      category: "Product Hunt",
      thumbnail: String((node.thumbnail as { url?: string } | undefined)?.url || ""),
      imageUrl: String((node.thumbnail as { url?: string } | undefined)?.url || ""),
      score: Number(node.votesCount) || 0,
      numComments: Number(node.commentsCount) || 0,
      publishedAt: String(node.createdAt || new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

// ── ingest ──

async function getFeedState(env: FeedEnv): Promise<FeedState> {
  const row = await env.DB.prepare("SELECT data FROM config WHERE id = 'feed_state'").first<{ data: string }>();
  try {
    return JSON.parse(row?.data || "{}") as FeedState;
  } catch {
    return { last: {} };
  }
}

async function saveFeedState(env: FeedEnv, state: FeedState): Promise<void> {
  const ts = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO config (id, data, created_at, updated_at) VALUES ('feed_state', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(JSON.stringify(state), ts, ts)
    .run();
}

async function ingest(env: FeedEnv, posts: FeedPostInput[]): Promise<number> {
  let added = 0;
  const ts = new Date().toISOString();
  const seen = new Set<string>();
  for (const p of posts) {
    const key = normalizeTitle(p.title);
    const titleKey = hashKey(key);
    if (!titleKey || seen.has(titleKey)) continue;
    seen.add(titleKey);
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO feed_posts
         (id, source, external_id, source_url, title, summary, tags, category,
          thumbnail, image_url, author, score, num_comments, comments,
          related_repos, title_key, published_at, fetched_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        genId(), p.source, p.externalId, p.sourceUrl, p.title,
        p.summary || "", JSON.stringify(p.tags || []), p.category || "",
        p.thumbnail || "", p.imageUrl || "", p.author || "",
        p.score || 0, p.numComments || 0, JSON.stringify(p.comments || []),
        JSON.stringify(p.relatedRepos || []), titleKey,
        p.publishedAt, ts, ts
      )
      .run();
    added += res.meta.changes ?? 0;
  }
  return added;
}

const FETCHERS: Record<FeedPostInput["source"], (env: FeedEnv) => Promise<FeedPostInput[]>> = {
  hn: fetchHN,
  reddit: fetchReddit,
  devto: fetchDevto,
  github: fetchGithub,
  producthunt: fetchProductHunt,
};

export interface RefreshResult {
  added: number;
  sources: Record<string, { fetched: number; status: string }>;
}

/** Fetch any source past its cooldown and store new posts (deduped). */
export async function refreshFeed(env: FeedEnv): Promise<RefreshResult> {
  const state = await getFeedState(env);
  if (!state.last) state.last = {};
  const now = Date.now();
  const result: RefreshResult = { added: 0, sources: {} };

  for (const source of SOURCES) {
    const last = state.last[source] ? new Date(state.last[source]).getTime() : 0;
    if (now - last < COOLDOWN_MS) {
      result.sources[source] = { fetched: 0, status: "cooldown" };
      continue;
    }
    let posts: FeedPostInput[] = [];
    try {
      posts = await FETCHERS[source](env);
    } catch {
      result.sources[source] = { fetched: 0, status: "error" };
      continue;
    }
    result.sources[source] = { fetched: posts.length, status: "ok" };
    if (posts.length > 0) {
      const added = await ingest(env, posts);
      result.added += added;
      state.last[source] = new Date(now).toISOString();
    }
  }

  await saveFeedState(env, state);
  return result;
}
