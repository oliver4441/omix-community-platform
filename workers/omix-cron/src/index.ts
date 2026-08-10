/**
 * omix-cron — scheduled worker.
 *
 * Runs every 5 minutes (see wrangler.toml [triggers]) and:
 *   - deletes stale typing indicators (older than 15s)
 *   - marks presence rows offline when the heartbeat has been silent for 2 minutes
 *   - ingests external feeds (HN / Reddit / GitHub / Product Hunt) into the
 *     feed_posts table — each source self-throttles via a cooldown, so this
 *     effectively refreshes every ~25 min per source
 *
 * Uses the same D1 database as the gateway and domain services.
 */

import { refreshFeed, type FeedEnv } from "../../feed/ingest";
import { deliverPending } from "../../shared/push";

export interface Env extends FeedEnv {
  DB: D1Database;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const cronWorker = {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
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

    // Feeds — never throws (refreshFeed handles per-source errors).
    try {
      const r = await refreshFeed(env);
      console.log("[omix-cron] feed refresh:", JSON.stringify(r.sources), "added:", r.added);
    } catch (err) {
      console.error("[omix-cron] feed refresh failed:", err);
    }

    // Web push — deliver queued notifications (DM / mention / GitHub webhook).
    try {
      const r = await deliverPending(env);
      console.log("[omix-cron] push delivery:", JSON.stringify(r));
    } catch (err) {
      console.error("[omix-cron] push delivery failed:", err);
    }
  },
};

export default cronWorker;
