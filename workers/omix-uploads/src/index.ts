/**
 * omix-uploads — file storage service: /upload (session-backed, KV) and
 * /assets/* (public static serving). Only reachable via omix-gateway.
 *
 * Assets are served publicly by the gateway before the session gate; uploads
 * arrive after the gateway has stamped the caller.
 */
import type { Env } from "../../shared/env";
import { json, sessionFromHeaders } from "../../shared/util";
import { handleUploads, serveAsset } from "./uploads";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Public asset serving (gateway forwards /assets/* before auth).
      if (path.startsWith("/assets/") && method === "GET") {
        const res = await serveAsset(env, path.slice("/assets/".length));
        return res || json({ error: "not_found" }, 404, env);
      }

      const user = sessionFromHeaders(request);
      if (!user) return json({ error: "unauthorized" }, 401, env);
      const handled = await handleUploads(request, env);
      if (handled) return handled;
      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-uploads] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
