/**
 * omix-social — community content service: profiles, stats, presence,
 * boardroom posts, code snippets and the external dev feed.
 * Only reachable via omix-gateway.
 */
import type { Env } from "../../shared/env";
import { json, sessionFromHeaders } from "../../shared/util";
import { handleProfiles } from "./profiles";
import { handleSocial } from "./social";

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const user = sessionFromHeaders(request);
      if (!user) return json({ error: "unauthorized" }, 401, env);
      const handled =
        (await handleProfiles(request, env, user)) ||
        (await handleSocial(request, env, user));
      if (handled) return handled;
      return json({ error: "not found" }, 404, env);
    } catch (err) {
      console.error("[omix-social] error:", err);
      return json({ error: "internal error" }, 500, env);
    }
  },
};

export default worker;
