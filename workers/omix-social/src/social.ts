/**
 * social — boardroom posts, code snippets and the external dev feed.
 *
 * Extracted from the former crud.ts monolith.
 */
import type { Env } from "../../shared/env";
import {
  json,
  readJson,
  now,
  genId,
  parseJson,
  stringifyJson,
  type SessionUser,
} from "../../shared/util";
import { refreshFeed } from "../../feed/ingest";

// ═══════════ mappers ═══════════

function mapPost(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    authorId: r.author_id,
    authorName: r.author_name,
    authorAvatar: r.author_avatar,
    authorColor: r.author_color,
    voteCount: (r.vote_count as number) || 0,
    createdAt: r.created_at,
  };
}

function mapSnippet(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    description: (r.description as string) || "",
    language: (r.language as string) || "text",
    code: (r.code as string) || "",
    tags: parseJson<string[]>(r.tags as string, []),
    authorId: (r.author_id as string) || "",
    authorName: (r.author_name as string) || "Anonymous",
    authorColor: (r.author_color as string) || "#a078ff",
    voteCount: (r.vote_count as number) || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapFeedPost(r: Record<string, unknown>) {
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    sourceUrl: r.source_url,
    title: r.title,
    summary: r.summary,
    tags: parseJson<string[]>(r.tags as string, []),
    category: r.category,
    thumbnail: r.thumbnail,
    imageUrl: r.image_url,
    author: r.author,
    score: r.score,
    numComments: r.num_comments,
    comments: parseJson<{ author: string; text: string }[]>(r.comments as string, []),
    relatedRepos: parseJson<{ name: string; url: string; stars: number }[]>(r.related_repos as string, []),
    publishedAt: r.published_at,
    fetchedAt: r.fetched_at,
  };
}

// ═══════════ helpers ═══════════

async function recomputeVotes(env: Env, postId: string): Promise<void> {
  const { results } = await env.DB.prepare("SELECT post_id FROM board_votes WHERE post_id = ?")
    .bind(postId)
    .all<{ post_id: string }>();
  const count = (results || []).length;
  await env.DB.prepare("UPDATE board_posts SET vote_count = ? WHERE id = ?").bind(count, postId).run();
}

async function recomputeSnippetVotes(env: Env, snippetId: string): Promise<void> {
  const { results } = await env.DB.prepare("SELECT snippet_id FROM snippet_votes WHERE snippet_id = ?")
    .bind(snippetId)
    .all<{ snippet_id: string }>();
  const count = (results || []).length;
  await env.DB.prepare("UPDATE snippets SET vote_count = ? WHERE id = ?").bind(count, snippetId).run();
}

// ═══════════ handler ═══════════

export async function handleSocial(
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  // ── Boardroom ──
  if (p === "/board-posts/mine-votes" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT post_id FROM board_votes WHERE session_id = ?"
    )
      .bind(user.id)
      .all<{ post_id: string }>();
    const votes: Record<string, number> = {};
    (results || []).forEach((r) => {
      votes[r.post_id] = 1;
    });
    return json({ votes }, 200, env);
  }
  const voteMatch = p.match(/^\/board-posts\/([^/]+)\/vote$/);
  if (voteMatch && method === "POST") {
    await env.DB.prepare(
      "INSERT INTO board_votes (post_id, session_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING"
    )
      .bind(voteMatch[1], user.id, now())
      .run();
    await recomputeVotes(env, voteMatch[1]);
    return json({ ok: true }, 200, env);
  }
  if (voteMatch && method === "DELETE") {
    await env.DB.prepare("DELETE FROM board_votes WHERE post_id = ? AND session_id = ?")
      .bind(voteMatch[1], user.id)
      .run();
    await recomputeVotes(env, voteMatch[1]);
    return json({ ok: true }, 200, env);
  }
  if (p === "/board-posts" && method === "GET") {
    const category = url.searchParams.get("category");
    let sql = "SELECT * FROM board_posts";
    const binds: unknown[] = [];
    if (category && category !== "all") {
      sql += " WHERE category = ?";
      binds.push(category);
    }
    sql += " ORDER BY vote_count DESC, created_at DESC LIMIT 200";
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return json((results || []).map(mapPost), 200, env);
  }
  if (p === "/board-posts" && method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    const id = genId();
    await env.DB.prepare(
      `INSERT INTO board_posts (id, title, body, category, author_id, author_name, author_avatar, author_color, vote_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
      .bind(
        id,
        (body.title as string) || "",
        (body.body as string) || "",
        (body.category as string) || "general",
        (body.authorId as string) || user.id,
        (body.authorName as string) || user.fullName,
        (body.authorAvatar as string) || "",
        (body.authorColor as string) || "#a078ff",
        now()
      )
      .run();
    return json({ id }, 200, env);
  }

  // ── Snippets ──
  if (p === "/snippets/mine-votes" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT snippet_id FROM snippet_votes WHERE session_id = ?"
    )
      .bind(user.id)
      .all<{ snippet_id: string }>();
    const votes: Record<string, boolean> = {};
    (results || []).forEach((r) => {
      votes[r.snippet_id] = true;
    });
    return json({ votes }, 200, env);
  }
  const snippetVoteMatch = p.match(/^\/snippets\/([^/]+)\/vote$/);
  if (snippetVoteMatch && method === "POST") {
    await env.DB.prepare(
      "INSERT INTO snippet_votes (snippet_id, session_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING"
    )
      .bind(snippetVoteMatch[1], user.id, now())
      .run();
    await recomputeSnippetVotes(env, snippetVoteMatch[1]);
    return json({ ok: true }, 200, env);
  }
  if (snippetVoteMatch && method === "DELETE") {
    await env.DB.prepare("DELETE FROM snippet_votes WHERE snippet_id = ? AND session_id = ?")
      .bind(snippetVoteMatch[1], user.id)
      .run();
    await recomputeSnippetVotes(env, snippetVoteMatch[1]);
    return json({ ok: true }, 200, env);
  }
  if (p === "/snippets" && method === "GET") {
    const language = url.searchParams.get("language");
    const tag = url.searchParams.get("tag");
    let sql = "SELECT * FROM snippets";
    const binds: unknown[] = [];
    const where: string[] = [];
    if (language && language !== "all") {
      where.push("language = ?");
      binds.push(language);
    }
    if (tag) {
      where.push("tags LIKE ?");
      binds.push(`%${tag}%`);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY vote_count DESC, created_at DESC LIMIT 200";
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return json((results || []).map(mapSnippet), 200, env);
  }
  if (p === "/snippets" && method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    if (!body.title || !String(body.title).trim()) {
      return json({ error: "title_required" }, 400, env);
    }
    const id = genId();
    const ts = now();
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10) : [];
    await env.DB.prepare(
      `INSERT INTO snippets (id, title, description, language, code, tags, author_id, author_name, author_color, vote_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
      .bind(
        id,
        String(body.title).trim().slice(0, 120),
        (body.description as string) || "",
        (body.language as string) || "text",
        (body.code as string) || "",
        stringifyJson(tags),
        user.id,
        (body.authorName as string) || user.fullName,
        (body.authorColor as string) || "#a078ff",
        ts,
        ts
      )
      .run();
    return json({ id }, 200, env);
  }
  const snippetMatch = p.match(/^\/snippets\/([^/]+)$/);
  if (snippetMatch && method === "PUT") {
    const body = await readJson<Record<string, unknown>>(request);
    const row = await env.DB.prepare("SELECT author_id FROM snippets WHERE id = ?")
      .bind(snippetMatch[1])
      .first<{ author_id: string }>();
    if (!row) return json({ error: "not_found" }, 404, env);
    if (row.author_id !== user.id && !user.isAdmin) {
      return json({ error: "forbidden" }, 403, env);
    }
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10) : [];
    await env.DB.prepare(
      `UPDATE snippets SET title = ?, description = ?, language = ?, code = ?, tags = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(
        String(body.title ?? "").trim().slice(0, 120),
        (body.description as string) || "",
        (body.language as string) || "text",
        (body.code as string) || "",
        stringifyJson(tags),
        now(),
        snippetMatch[1]
      )
      .run();
    return json({ ok: true }, 200, env);
  }
  if (snippetMatch && method === "DELETE") {
    const row = await env.DB.prepare("SELECT author_id FROM snippets WHERE id = ?")
      .bind(snippetMatch[1])
      .first<{ author_id: string }>();
    if (!row) return json({ error: "not_found" }, 404, env);
    if (row.author_id !== user.id && !user.isAdmin) {
      return json({ error: "forbidden" }, 403, env);
    }
    await env.DB.prepare("DELETE FROM snippet_votes WHERE snippet_id = ?").bind(snippetMatch[1]).run();
    await env.DB.prepare("DELETE FROM snippets WHERE id = ?").bind(snippetMatch[1]).run();
    return json({ ok: true }, 200, env);
  }

  // ── External feeds ──
  if (p === "/feed" && method === "GET") {
    const source = url.searchParams.get("source");
    const tag = url.searchParams.get("tag");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    let sql = "SELECT * FROM feed_posts";
    const binds: unknown[] = [];
    const where: string[] = [];
    if (source) {
      where.push("source = ?");
      binds.push(source);
    }
    if (tag) {
      where.push("tags LIKE ?");
      binds.push(`%"${tag}"%`);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY published_at DESC LIMIT ? OFFSET ?";
    binds.push(limit, offset);
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return json((results || []).map(mapFeedPost), 200, env);
  }
  if (p === "/feed/refresh" && method === "POST") {
    // Manual refresh — same cooldowns as the cron, so this is safe to call.
    const result = await refreshFeed(env);
    return json(result, 200, env);
  }

  return null;
}
