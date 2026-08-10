/**
 * omix-notifications — notification settings and web-push subscriptions.
 * Only reachable via omix-gateway.
 */
import type { Env } from "../../shared/env";
import { json, sessionFromHeaders } from "../../shared/util";
import { handleNotifications } from "./notifications";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const user = sessionFromHeaders(request);
      if (!user) return json({ error: "unauthorized" }, 401, env);
      const handled = await handleNotifications(request, env, user);
      if (handled) return handled;
      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-notifications] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
