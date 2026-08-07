/**
 * omix-cron — scheduled cleanup worker.
 *
 * Runs every 5 minutes (see wrangler.toml [triggers]) and:
 *   - deletes stale typing indicators (older than 15s)
 *   - marks presence rows offline when the heartbeat has been silent for 2 minutes
 *
 * Uses the same D1 database as omix-api.
 */

export interface Env {
  DB: D1Database;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const typingCutoff = new Date(Date.now() - 15_000).toISOString();
    const presenceCutoff = new Date(Date.now() - 120_000).toISOString();

    await env.DB.prepare("DELETE FROM typing WHERE created_at < ?")
      .bind(typingCutoff)
      .run()
      .catch(() => {});

    await env.DB.prepare("UPDATE presence SET online = 0 WHERE last_seen < ?")
      .bind(presenceCutoff)
      .run()
      .catch(() => {});
  },
};
