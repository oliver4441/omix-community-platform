/**
 * omix-cron — scheduled cleanup worker.
 *
 * Runs every 5 minutes (see wrangler.toml [triggers]) and:
 *   - deletes stale typing indicators (older than 15s)
 *   - marks presence rows offline when the heartbeat has been silent for 2 minutes
 *
 * Uses the Supabase service-role key server-side (never exposed to the client).
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

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

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const typingCutoff = encodeURIComponent(new Date(Date.now() - 15_000).toISOString());
    const presenceCutoff = encodeURIComponent(new Date(Date.now() - 120_000).toISOString());

    // Stale typing indicators
    await supabaseFetch(env, `/rest/v1/typing?created_at=lt.${typingCutoff}`, {
      method: "DELETE",
    }).catch(() => {});

    // Presence rows with no recent heartbeat
    await supabaseFetch(env, `/rest/v1/presence?last_seen=lt.${presenceCutoff}`, {
      method: "PATCH",
      body: JSON.stringify({ online: false }),
    }).catch(() => {});
  },
};
