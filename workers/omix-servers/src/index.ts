/**
 * omix-servers — community structure service: servers, channels, invites,
 * app config/admin and the call log. Only reachable via omix-gateway.
 */
import type { Env } from "../../shared/env";
import { json, sessionFromHeaders } from "../../shared/util";
import { handleServers } from "./servers";
import { handleConfig } from "./config";
import { handleCalls } from "./calls";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const user = sessionFromHeaders(request);
      if (!user) return json({ error: "unauthorized" }, 401, env);
      const handled =
        (await handleServers(request, env, user)) ||
        (await handleConfig(request, env, user)) ||
        (await handleCalls(request, env, user));
      if (handled) return handled;
      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-servers] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
