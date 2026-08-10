/**
 * omix-auth — identity service: signup/login/verify/reset, sessions and
 * GitHub OAuth. Only reachable via the omix-gateway service binding.
 *
 * Public routes (/auth/signup, /auth/login, /auth/verify, /auth/forgot,
 * /auth/reset, /auth/github/*, /github/webhook) are forwarded by the gateway
 * untouched. Session-backed routes (/auth/me, /auth/logout, /auth/change-password,
 * /auth/account) read the bearer token directly (this service owns the
 * sessions table).
 */
import type { Env } from "../../shared/env";
import { json, getBearer, getSessionUser } from "../../shared/util";
import { handleAuth } from "./auth";
import { handleGithub, handleGithubWebhook } from "./github";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ── Auth routes ──
      if (path.startsWith("/auth/")) {
        const handled = await handleAuth(path, request, env);
        if (handled) return handled;
        // Session endpoints handled here (owner of the sessions table).
        if (path === "/auth/me" && method === "GET") {
          const user = await getSessionUser(env, request);
          if (!user) return json({ error: "unauthorized" }, 401, env);
          return json({ user }, 200, env);
        }
        if (path === "/auth/logout" && method === "POST") {
          const token = getBearer(request);
          if (token) {
            await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
          }
          return json({ ok: true }, 200, env);
        }
        return json({ error: "not found" }, 404, env);
      }

      // ── GitHub webhook (public, HMAC-verified) ──
      if (path === "/github/webhook") {
        const wh = await handleGithubWebhook(path, request, env);
        if (wh) return wh;
      }

      // ── GitHub API routes need a session — the gateway stamps the caller.
      if (path === "/github/repos" || /^\/profiles\/[^/]+\/github$/.test(path)) {
        const user = await getSessionUser(env, request);
        if (!user) return json({ error: "unauthorized" }, 401, env);
        const gh = await handleGithub(path, request, env, user);
        if (gh) return gh;
      }

      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-auth] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
