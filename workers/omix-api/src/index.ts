/**
 * omix-api — Omix Community backend on Cloudflare Workers.
 *
 * Replaces Supabase entirely: D1 (database), R2 (file storage), and a custom
 * auth layer (email/password + GitHub OAuth) all live in this worker.
 *
 * Routes:
 *   GET  /health                          health check
 *   GET|POST /ably/token                  short-lived Ably token
 *   POST /auth/signup|verify|login|forgot|reset|resend-verification
 *   GET  /auth/github/login  /auth/github/callback
 *   GET  /auth/me            POST /auth/logout
 *   ...   /servers, /channels, /messages, /dm-channels, /presence, /typing,
 *         /profiles, /stats, /call-log, /board-posts, /notification-settings,
 *         /invites, /config, /admin, /upload, /assets/*  (see crud.ts)
 */
import Ably from "ably";
import type { Env } from "./env";
import { json, corsHeaders, now, getBearer, requireUser, getSessionUser } from "./util";
import { handleAuth } from "./auth";
import { handleCrud, serveAsset } from "./crud";
import { handleGithub } from "./github";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function createAblyToken(env: Env, clientId: string) {
  const rest = new Ably.Rest(env.ABLY_API_KEY);
  return rest.auth.createTokenRequest({
    clientId,
    ttl: 60 * 60 * 1000,
    capability: { "*": ["publish", "subscribe", "presence"] },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      if (path === "/health" && request.method === "GET") {
        return json({ ok: true, service: "omix-api", time: now() }, 200, env);
      }

      if (path === "/ably/token") {
        if (env.TOKEN_AUTH_SECRET) {
          const header = request.headers.get("Authorization") || "";
          if (header !== `Bearer ${env.TOKEN_AUTH_SECRET}`) {
            return json({ error: "unauthorized" }, 401, env);
          }
        }
        let clientId = url.searchParams.get("clientId") || undefined;
        if (request.method === "POST") {
          const body = (await request.json().catch(() => ({}))) as { clientId?: string };
          clientId = body.clientId || clientId;
        }
        if (!clientId) return json({ error: "clientId is required" }, 400, env);
        const tokenRequest = await createAblyToken(env, clientId);
        return json(tokenRequest, 200, env);
      }

      // ── Auth routes (no session required) ──
      if (path.startsWith("/auth/")) {
        const handled = await handleAuth(path, request, env);
        if (handled) return handled;
        // Session endpoints below
        if (path === "/auth/me" && request.method === "GET") {
          const user = await getSessionUser(env, request);
          if (!user) return json({ error: "unauthorized" }, 401, env);
          return json({ user }, 200, env);
        }
        if (path === "/auth/logout" && request.method === "POST") {
          const token = getBearer(request);
          if (token) {
            await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
          }
          return json({ ok: true }, 200, env);
        }
        return json({ error: "not found" }, 404, env);
      }

      // ── Uploaded files are public (no session needed) ──
      if (path.startsWith("/assets/") && request.method === "GET") {
        const res = await serveAsset(env, path.slice("/assets/".length));
        return res || json({ error: "not_found" }, 404, env);
      }

      // ── Everything else requires a session ──
      const auth = await requireUser(env, request);
      if ("response" in auth) return auth.response;
      const gh = await handleGithub(path, request, env, auth.user);
      if (gh) return gh;
      const handled = await handleCrud(request, env, auth.user);
      if (handled) return handled;

      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-api] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};
