/**
 * GitHub integration.
 *
 *  GET /github/repos            (owner, token-backed) — the signed-in user's
 *                               repos, public + private, plus follower counts.
 *  GET /profiles/:id/github     (public) — anyone's PUBLIC repos + counts via
 *                               the unauthenticated GitHub API, so other users
 *                               can browse a profile's repositories.
 *  POST /github/webhook         (public, HMAC-verified) — GitHub webhook that
 *                               posts repo activity to the boardroom and
 *                               notifies the repo owner.
 *
 * Both GET routes are behind the normal session check in index.ts; the
 * webhook is served before auth so GitHub can call it unauthenticated.
 */

import { json, now, genId, stringifyJson, type SessionUser } from "../../shared/util";
import type { Env } from "../../shared/env";

interface GithubTokenRow {
  access_token: string;
  scope: string;
}

interface GithubRepoRaw {
  full_name?: string;
  name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  updated_at?: string;
  topics?: string[];
  homepage?: string | null;
}

interface GithubUserRaw {
  login?: string;
  followers?: number;
  following?: number;
  public_repos?: number;
  avatar_url?: string;
  bio?: string | null;
}

function mapRepo(r: GithubRepoRaw) {
  return {
    fullName: r.full_name || "",
    name: r.name || "",
    htmlUrl: r.html_url || "",
    description: r.description || "",
    language: r.language || null,
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    private: Boolean(r.private),
    fork: Boolean(r.fork),
    archived: Boolean(r.archived),
    updatedAt: r.updated_at || "",
    topics: r.topics || [],
    homepage: r.homepage || null,
  };
}

function mapUser(u: GithubUserRaw) {
  return {
    login: u.login || "",
    followers: u.followers || 0,
    following: u.following || 0,
    publicRepos: u.public_repos || 0,
    avatarUrl: u.avatar_url || "",
    bio: u.bio || "",
  };
}

async function ghFetch(path: string, token: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "omix-community",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function handleGithub(
  path: string,
  request: Request,
  env: Env,
  user: SessionUser
): Promise<Response | null> {
  if (request.method !== "GET") return null;

  // ── Owner: token-backed (public + private repos) ──
  if (path === "/github/repos") {
    const row = await env.DB.prepare(
      "SELECT access_token, scope FROM github_tokens WHERE user_id = ?"
    )
      .bind(user.id)
      .first<GithubTokenRow>();
    if (!row?.access_token) {
      return json({ connected: false }, 200, env);
    }

    const [userRes, reposRes] = await Promise.all([
      ghFetch("/user", row.access_token),
      ghFetch("/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator", row.access_token),
    ]);

    // Revoked/expired token — drop it so the client shows the connect CTA.
    if (userRes.status === 401 || reposRes.status === 401) {
      await env.DB.prepare("DELETE FROM github_tokens WHERE user_id = ?").bind(user.id).run();
      return json({ connected: false, error: "token_invalid" }, 200, env);
    }
    if (!userRes.ok || !reposRes.ok) {
      return json(
        {
          connected: true,
          error: reposRes.status === 403 ? "rate_limited" : "github_error",
          user: null,
          repos: [],
        },
        200,
        env
      );
    }

    const ghUser = userRes.data as GithubUserRaw;
    const rawRepos = (reposRes.data as GithubRepoRaw[]) || [];
    return json(
      {
        connected: true,
        user: mapUser(ghUser),
        repos: rawRepos.map(mapRepo),
        syncedAt: now(),
      },
      200,
      env
    );
  }

  // ── Anyone: public repos for a profile owner (no token needed) ──
  const profileMatch = path.match(/^\/profiles\/([^/]+)\/github$/);
  if (profileMatch) {
    const targetId = profileMatch[1];
    const prof = await env.DB.prepare("SELECT github_username FROM profiles WHERE session_id = ?")
      .bind(targetId)
      .first<{ github_username: string }>();
    let login = prof?.github_username || "";
    if (!login) {
      const u = await env.DB.prepare("SELECT github_username FROM users WHERE id = ?")
        .bind(targetId)
        .first<{ github_username: string }>();
      login = u?.github_username || "";
    }
    if (!login) return json({ connected: false }, 200, env);

    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "omix-community",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=100`, { headers }),
    ]);
    if (userRes.status === 404) return json({ connected: false }, 200, env);
    if (!userRes.ok || !reposRes.ok) {
      return json(
        {
          connected: true,
          error: reposRes.status === 403 || userRes.status === 403 ? "rate_limited" : "github_error",
          user: null,
          repos: [],
        },
        200,
        env
      );
    }

    const ghUser = (await userRes.json()) as GithubUserRaw;
    const rawRepos = ((await reposRes.json()) as GithubRepoRaw[]) || [];
    return json(
      {
        connected: true,
        user: mapUser(ghUser),
        repos: rawRepos.filter((r) => !r.private).map(mapRepo),
        syncedAt: now(),
      },
      200,
      env
    );
  }

  return null;
}

// ── Webhook (public, no session) ──

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface GithubWebhookPayload {
  sender?: { login?: string };
  repository?: {
    full_name?: string;
    html_url?: string;
    owner?: { login?: string };
  };
  commits?: Array<{ message?: string; url?: string }>;
  release?: { tag_name?: string; name?: string | null };
  issue?: { number?: number; title?: string };
  pull_request?: { number?: number; title?: string };
  action?: string;
}

export async function handleGithubWebhook(
  path: string,
  request: Request,
  env: Env
): Promise<Response | null> {
  if (path !== "/github/webhook" || request.method !== "POST") return null;
  if (!env.GITHUB_WEBHOOK_SECRET) {
    return json({ error: "not_configured" }, 503, env);
  }

  const signature = request.headers.get("X-Hub-Signature-256") || "";
  const raw = await request.text();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected =
    "sha256=" +
    [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!constantTimeEqual(signature, expected)) {
    return json({ error: "bad_signature" }, 401, env);
  }

  const event = request.headers.get("X-GitHub-Event") || "push";
  let payload: GithubWebhookPayload = {};
  try {
    payload = JSON.parse(raw) as GithubWebhookPayload;
  } catch {
    return json({ error: "bad_payload" }, 400, env);
  }

  const login =
    payload.repository?.owner?.login || payload.sender?.login || "";
  if (!login) return json({ ok: true, ignored: "no_login" }, 200, env);

  const owner = await env.DB.prepare(
    "SELECT id, full_name, avatar_url FROM users WHERE github_username = ?"
  )
    .bind(login)
    .first<{ id: string; full_name: string; avatar_url: string }>();
  if (!owner) return json({ ok: true, ignored: "no_owner_user" }, 200, env);

  const repo = payload.repository?.full_name || "";
  const htmlUrl =
    payload.repository?.html_url || `https://github.com/${repo}`;

  let title = "";
  let body = "";
  switch (event) {
    case "push":
      title = `${login} pushed ${payload.commits?.length ?? 0} commit(s) to ${repo}`;
      body = (payload.commits || [])
        .map((c) => `- ${(c.message || "").split("\n")[0]}`)
        .join("\n");
      break;
    case "release":
      title = `New release ${payload.release?.tag_name || ""} of ${repo}`;
      body = payload.release?.name || "";
      break;
    case "star":
    case "watch":
      title = `${login} starred ${repo}`;
      break;
    case "fork":
      title = `${login} forked ${repo}`;
      break;
    case "issues":
      title = `${login} ${payload.action || "opened"} issue #${payload.issue?.number ?? ""} in ${repo}`;
      body = payload.issue?.title || "";
      break;
    case "pull_request":
      title = `${login} ${payload.action || "opened"} PR #${payload.pull_request?.number ?? ""} in ${repo}`;
      body = payload.pull_request?.title || "";
      break;
    default:
      title = `${event} in ${repo}`;
  }
  title = title.slice(0, 200);
  if (body) body = body.slice(0, 1000);

  const ts = now();
  await env.DB.prepare(
    `INSERT INTO board_posts (id, title, body, category, author_id, author_name, author_avatar, author_color, vote_count, created_at)
     VALUES (?, ?, ?, 'dev', ?, ?, ?, '#a078ff', 0, ?)`
  )
    .bind(
      genId(),
      title,
      body,
      owner.id,
      owner.full_name || login,
      owner.avatar_url || "",
      ts
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO notifications (id, target_user_id, title, body, data, sent, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  )
    .bind(
      genId(),
      owner.id,
      title,
      body || htmlUrl,
      stringifyJson({ type: "github", url: htmlUrl }),
      ts
    )
    .run();

  return json({ ok: true }, 200, env);
}
