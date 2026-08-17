export type FeedSource = "github" | "reddit" | "devto" | "hackernews" | "producthunt";

export interface FeedRefreshState {
  lastRefreshAt: number;
  refreshing: boolean;
  failedSources: FeedSource[];
}

const DEV_FEED_INTERVAL = 3 * 60 * 1000;

export function shouldRefreshDeveloperFeed(lastRefreshAt: number | null, now = Date.now()) {
  return lastRefreshAt === null || now - lastRefreshAt >= DEV_FEED_INTERVAL;
}

export function getRefreshInterval() {
  return DEV_FEED_INTERVAL;
}

export function mergeNewFeedItems<T extends { id?: string; url?: string }>(current: T[], incoming: T[]) {
  const seen = new Set(current.map((item) => item.id || item.url).filter(Boolean));
  return [...incoming.filter((item) => {
    const key = item.id || item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }), ...current];
}
