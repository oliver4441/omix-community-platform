/**
 * Outbox — offline-first message queue.
 *
 * Messages composed while offline (or when the API call fails) are persisted
 * to IndexedDB with a client nonce. When connectivity returns, the queue
 * replays in order; the server dedupes by nonce, so replays are idempotent.
 *
 * Drafts are stored per channel and survive refreshes/offline sessions.
 */
import { idb } from "./storage";
import { publish, subscribe } from "./events";

const OUTBOX_STORE = "outbox";
const DRAFTS_STORE = "drafts";

export interface OutboxEntry {
  nonce: string;
  channelId: string;
  payload: Record<string, unknown>;
  queuedAt: number;
  attempts: number;
}

export interface ChannelDraft {
  channelId: string;
  text: string;
  replyTo?: unknown;
  updatedAt: number;
}

function makeNonce(): string {
  return `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createNonce(): string {
  return makeNonce();
}

export async function enqueue(channelId: string, payload: Record<string, unknown>): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    nonce: (payload.nonce as string) || makeNonce(),
    channelId,
    payload: { ...payload, nonce: (payload.nonce as string) || "" },
    queuedAt: Date.now(),
    attempts: 0,
  };
  entry.payload.nonce = entry.nonce;
  await idb.put(OUTBOX_STORE, entry.nonce, entry);
  publish("outbox:changed", { count: await count() });
  return entry;
}

export async function remove(nonce: string): Promise<void> {
  await idb.delete(OUTBOX_STORE, nonce);
  publish("outbox:changed", { count: await count() });
}

export async function list(): Promise<OutboxEntry[]> {
  const entries = await idb.all<OutboxEntry>(OUTBOX_STORE);
  return entries.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function listForChannel(channelId: string): Promise<OutboxEntry[]> {
  return (await list()).filter((entry) => entry.channelId === channelId);
}

export async function count(): Promise<number> {
  return (await list()).length;
}

export async function bumpAttempts(nonce: string): Promise<void> {
  const entries = await list();
  const entry = entries.find((e) => e.nonce === nonce);
  if (entry) {
    entry.attempts += 1;
    await idb.put(OUTBOX_STORE, nonce, entry);
  }
}

export function onOutboxChange(cb: (count: number) => void): () => void {
  return subscribe<{ count: number }>("outbox:changed", ({ count }) => cb(count));
}

// ── Drafts ──
export async function saveDraft(channelId: string, text: string, replyTo?: unknown): Promise<void> {
  const draft: ChannelDraft = {
    channelId,
    text,
    replyTo,
    updatedAt: Date.now(),
  };
  await idb.put(DRAFTS_STORE, channelId, draft);
}

export async function getDraft(channelId: string): Promise<ChannelDraft | undefined> {
  return idb.get<ChannelDraft>(DRAFTS_STORE, channelId);
}

export async function clearDraft(channelId: string): Promise<void> {
  await idb.delete(DRAFTS_STORE, channelId);
}
