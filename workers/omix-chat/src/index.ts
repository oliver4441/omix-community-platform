/**
 * omix-chat — messaging service: channels messages, threads, pins,
 * reactions, DM channels and typing. Only reachable via omix-gateway.
 * The gateway validates the session and stamps the caller; we trust it.
 */
import type { Env } from "../../shared/env";
import { json, sessionFromHeaders } from "../../shared/util";
import { handleChat } from "./chat";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const user = sessionFromHeaders(request);
      if (!user) return json({ error: "unauthorized" }, 401, env);
      const handled = await handleChat(request, env, user);
      if (handled) return handled;
      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-chat] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
