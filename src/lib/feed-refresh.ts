export type DeveloperFeedSource = "hackernews" | "reddit" | "devto" | "github" | "producthunt";

export interface FeedRefreshSnapshot {
  refreshedAt: number;
  sourceStatus: Record<DeveloperFeedSource, "ok" | "error">;
}

export const DEVELOPER_FEED_REFRESH_MS = 3 * 60 * 1000;

export function shouldRefreshFeed(lastRefresh: number | null, now = Date.now()) {
  return lastRefresh === null || now - lastRefresh >= DEVELOPER_FEED_REFRESH_MS;
}

export function mergeFeedItems<T extends { id?: string; url?: string }>(existing: T[], incoming: T[]) {
  const seen = new Set(existing.map((item) => item.id ?? item.url).filter(Boolean));
  const fresh = incoming.filter((item) => {
    const key = item.id ?? item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...fresh, ...existing];
}
