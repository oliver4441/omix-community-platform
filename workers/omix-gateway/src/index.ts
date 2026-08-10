/**
 * omix-gateway — the ONLY public entrypoint for the Omix backend.
 *
 * Responsibilities:
 *   - CORS preflight + uniform CORS on every response
 *   - Public endpoints that live at the edge: /health, /ably/token,
 *     /assets/* (static files), /push/vapid-public-key, /github/webhook
 *   - Session validation for every authenticated route (single auth boundary)
 *   - Route to the owning domain worker via service bindings, stamping the
 *     caller as X-Omix-User-* headers (see workers/shared/util.ts).
 *
 * Domain workers are unreachable from the internet (workers_dev = false and
 * no routes), so they can trust the stamped headers.
 *
 * Route table:
 *   /auth/, /github/                       → omix-auth
 *   /messages/, /dm-channels, /typing,
 *   /threads/, /channels/:id/messages,
 *   /channels/:id/pins                     → omix-chat
 *   /servers/, /channels/, /invites/,
 *   /config/, /admin/, /call-log           → omix-servers
 *   /profiles/, /stats/, /presence,
 *   /me/status, /board-posts,
 *   /snippets/, /feed                      → omix-social
 *   /notification-settings, /push/         → omix-notifications
 *   /upload, /assets/                      → omix-uploads
 */
import Ably from "ably";
import type { Env } from "../../shared/env";
import { json, corsHeaders, now, requireUser, withUserHeaders } from "../../shared/util";
import { getVapidPublicKey } from "../../shared/push";

/** Service bindings — declared in workers/omix-gateway/wrangler.toml. */
type ServiceKey =
  | "AUTH"
  | "CHAT"
  | "SERVERS"
  | "SOCIAL"
  | "NOTIFICATIONS"
  | "UPLOADS";

export interface GatewayEnv extends Env {
  AUTH: Fetcher;
  CHAT: Fetcher;
  SERVERS: Fetcher;
  SOCIAL: Fetcher;
  NOTIFICATIONS: Fetcher;
  UPLOADS: Fetcher;
}

async function createAblyToken(env: GatewayEnv, clientId: string) {
  const rest = new Ably.Rest(env.ABLY_API_KEY);
  return rest.auth.createTokenRequest({
    clientId,
    ttl: 60 * 60 * 1000,
    capability: { "*": ["publish", "subscribe", "presence"] },
  });
}

/** Add uniform CORS to a response coming back from a domain service. */
function withCors(res: Response, env: GatewayEnv): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(env))) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Map a path to the service binding that owns it. */
function routeFor(path: string): ServiceKey | null {
  if (path === "/upload") return "UPLOADS";
  if (path.startsWith("/assets/")) return "UPLOADS";

  if (path.startsWith("/auth/") || path.startsWith("/github/")) return "AUTH";
  // GitHub profile endpoints live in omix-auth (owns github.ts) even though
  // the path looks like a profile route.
  if (/^\/profiles\/[^/]+\/github$/.test(path)) return "AUTH";

  // Chat routes (before the generic /channels catch in servers)
  if (
    path.startsWith("/messages/") ||
    path === "/dm-channels" ||
    path === "/typing" ||
    path.startsWith("/threads/") ||
    /^\/channels\/[^/]+\/(messages|pins)(\/|$)/.test(path)
  ) {
    return "CHAT";
  }

  // Exact /servers (list/create) and /servers/* (detail/channels/invite) both live here.
  if (path === "/servers" || path.startsWith("/servers/") || path.startsWith("/invites/")) return "SERVERS";
  if (path.startsWith("/channels/")) return "SERVERS";
  if (path.startsWith("/config/") || path.startsWith("/admin/")) return "SERVERS";
  // Call log lives in omix-servers (calls.ts).
  if (path.startsWith("/call-log")) return "SERVERS";

  if (
    path === "/profiles" ||
    path.startsWith("/profiles/") ||
    path.startsWith("/stats/") ||
    path === "/presence" ||
    path === "/me/status" ||
    path.startsWith("/board-posts") ||
    path.startsWith("/snippets") ||
    path.startsWith("/feed")
  ) {
    return "SOCIAL";
  }

  if (path.startsWith("/notification-settings") || path.startsWith("/push/")) {
    return "NOTIFICATIONS";
  }

  return null;
}

const worker = {
  async fetch(request: Request, env: GatewayEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      // ── Edge-level public endpoints ──
      if (path === "/health" && request.method === "GET") {
        return json({ ok: true, service: "omix-gateway", time: now() }, 200, env);
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

      // ── Public routes forwarded as-is (no session needed) ──
      if (path.startsWith("/assets/") && request.method === "GET") {
        return withCors(await env.UPLOADS.fetch(request), env);
      }
      if (path === "/push/vapid-public-key" && request.method === "GET") {
        if (!env.VAPID_PRIVATE_KEY) {
          return json({ error: "push_not_configured" }, 503, env);
        }
        try {
          return json({ publicKey: await getVapidPublicKey(env) }, 200, env);
        } catch (err) {
          console.error("[omix-gateway] vapid key error:", err);
          return json({ error: "push_not_configured" }, 500, env);
        }
      }
      if (path === "/github/webhook") {
        return withCors(await env.AUTH.fetch(request), env);
      }

      // ── Auth routes: public ones (signup/login/verify) and the session
      //    endpoints (/auth/me, /auth/logout, /auth/change-password, …) all
      //    live in omix-auth — forward untouched. ──
      if (path.startsWith("/auth/")) {
        return withCors(await env.AUTH.fetch(request), env);
      }

      // ── Everything else requires a session ──
      const auth = await requireUser(env, request);
      if ("response" in auth) return auth.response;
      const target = routeFor(path);
      if (!target) return json({ error: "not found" }, 404, env);
      const stamped = withUserHeaders(request, auth.user);
      return withCors(await env[target].fetch(stamped), env);
    } catch (err) {
      console.error("[omix-gateway] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
