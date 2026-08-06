/**
 * omix-api — the app's backend API worker.
 *
 * Routes:
 *   GET  /health                     -> health check
 *   GET|POST /ably/token             -> short-lived Ably token (replaces the hardcoded key)
 *   POST /admin/verify-password      -> admin password check via Supabase service role
 *   POST /notifications/queue        -> queue a push notification (notifications table)
 *
 * Secrets come from Cloudflare (wrangler secret put), never from the client.
 */
import Ably from "ably";

export interface Env {
  ABLY_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CORS_ORIGIN?: string;
  /** Optional shared secret. When set, /ably/token requires it in the Authorization header. */
  TOKEN_AUTH_SECRET?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function corsHeaders(env: Env): Record<string, string> {
  const origin = env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(env) },
  });
}

/** Authenticated PostgREST call using the service-role key (server-side only). */
function supabaseFetch(env: Env, path: string, init: RequestInit = {}) {
  return fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function createAblyToken(env: Env, clientId: string) {
  const rest = new Ably.Rest(env.ABLY_API_KEY);
  // 1 hour TTL, full channel capability (scoped to this app's use of Ably).
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
        return json({ ok: true, service: "omix-api", time: new Date().toISOString() }, 200, env);
      }

      if (path === "/ably/token") {
        // Optional gate: if TOKEN_AUTH_SECRET is configured, require it so anyone
        // with the worker URL can't mint tokens for arbitrary client ids.
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

      if (path === "/admin/verify-password" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as { password?: string };
        if (!body.password) return json({ error: "password is required" }, 400, env);
        const res = await supabaseFetch(env, "/rest/v1/config?id=eq.settings&select=data");
        const rows = (await res.json()) as Array<{ data?: { adminPassword?: string } }>;
        const stored = rows?.[0]?.data?.adminPassword;
        return json({ valid: Boolean(stored) && stored === body.password }, 200, env);
      }

      if (path === "/notifications/queue" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          userId?: string;
          title?: string;
          body?: string;
          data?: Record<string, unknown>;
        };
        if (!body.userId || !body.title) {
          return json({ error: "userId and title are required" }, 400, env);
        }
        const res = await supabaseFetch(env, "/rest/v1/notifications", {
          method: "POST",
          body: JSON.stringify({
            target_user_id: body.userId,
            title: body.title,
            body: body.body || "",
            data: body.data || {},
          }),
        });
        return json({ ok: res.ok }, res.ok ? 200 : 502, env);
      }

      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-api] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};
