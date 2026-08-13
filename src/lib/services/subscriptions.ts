/**
 * Refcounted polling manager.
 *
 * Before this layer, every component mounted its own setInterval against the
 * same endpoints (AppLayout + WorkspaceRail both polled /servers, ChatPane
 * polled pins/typing/presence…). Now identical polls share ONE timer:
 *
 *   const unsub = pollRef("servers", fetchServers, 10_000);
 *
 * - Multiple subscribers to the same key → a single interval.
 * - The interval only runs when the tab is visible and the network is online
 *   (polling a dead network is waste; the connection service triggers an
 *   immediate refresh when connectivity returns).
 * - `flush(key)` re-runs a poll immediately.
 * - Unsubscribe functions are idempotent and safe to call twice.
 */
import { isOnline, initConnectionService } from "./connection";
import { subscribe } from "./events";

interface PollEntry {
  key: string;
  fn: () => void;
  intervalMs: number;
  subscribers: number;
  timer: ReturnType<typeof setInterval> | null;
}

const polls = new Map<string, PollEntry>();

function documentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function shouldRun(): boolean {
  return documentVisible() && isOnline();
}

function runAll() {
  for (const entry of polls.values()) {
    try {
      if (shouldRun()) entry.fn();
    } catch (err) {
      console.error(`[polls] ${entry.key} failed:`, err);
    }
  }
}

let bound = false;

function bindGlobalListeners() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  // Ensure online/offline tracking is active before polling depends on it.
  initConnectionService();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") runAll();
  });
  window.addEventListener("online", runAll);
  // Refresh immediately after the connection service reports restored.
  subscribe("connection:restored", runAll);
}

function start(entry: PollEntry) {
  if (entry.timer) return;
  // Run once immediately, then on the interval.
  try {
    if (shouldRun()) entry.fn();
  } catch (err) {
    console.error(`[polls] ${entry.key} failed:`, err);
  }
  entry.timer = setInterval(() => {
    if (!shouldRun()) return;
    try {
      entry.fn();
    } catch (err) {
      console.error(`[polls] ${entry.key} failed:`, err);
    }
  }, entry.intervalMs);
}

function stop(entry: PollEntry) {
  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }
}

/** Subscribe to a shared poll. Returns an idempotent unsubscribe function. */
export function pollRef(key: string, fn: () => void, intervalMs: number): () => void {
  bindGlobalListeners();
  let entry = polls.get(key);
  if (!entry) {
    entry = { key, fn, intervalMs, subscribers: 0, timer: null };
    polls.set(key, entry);
  }
  entry.fn = fn; // latest callback wins
  entry.subscribers += 1;
  start(entry);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = polls.get(key);
    if (!current) return;
    current.subscribers -= 1;
    if (current.subscribers <= 0) {
      stop(current);
      polls.delete(key);
    }
  };
}

/** Run one poll immediately (e.g. after a mutation). */
export function flushPoll(key: string): void {
  const entry = polls.get(key);
  if (!entry) return;
  try {
    if (shouldRun()) entry.fn();
  } catch (err) {
    console.error(`[polls] ${key} failed:`, err);
  }
}

/** Stop all polls (logout / full teardown). */
export function clearAllPolls(): void {
  for (const entry of polls.values()) stop(entry);
  polls.clear();
}
