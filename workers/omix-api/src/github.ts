/**
 * GitHub integration — lists the signed-in user's repositories on their
 * profile. The OAuth access token is persisted at callback time (auth.ts),
 * so we never ask the user for credentials again; the /github/repos route is
 * gated behind the normal session check in index.ts.
 */

import { json, now, type SessionUser } from "./util";
import type { Env } from "./env";

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
  if (path !== "/github/repos" || request.method !== "GET") return null;

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

  const repos = rawRepos.map((r) => ({
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
  }));

  return json(
    {
      connected: true,
      user: {
        login: ghUser.login || "",
        followers: ghUser.followers || 0,
        following: ghUser.following || 0,
        publicRepos: ghUser.public_repos || 0,
        avatarUrl: ghUser.avatar_url || "",
      },
      repos,
      syncedAt: now(),
    },
    200,
    env
  );
}
