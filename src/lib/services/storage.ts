/**
 * Offline storage — IndexedDB KV wrapper + localStorage helpers.
 *
 * IndexedDB is used for: outgoing message queue (outbox), per-channel drafts,
 * cached channel/message snapshots, notification cache. All writes are
 * fire-and-forget with error capture; reads degrade to undefined when
 * IndexedDB is unavailable (private mode, old browsers).
 */

const DB_NAME = "omix-offline";
const DB_VERSION = 1;
const STORES = ["kv", "drafts", "outbox", "cache"] as const;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("[storage] IndexedDB unavailable:", request.error);
        dbPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn("[storage] IndexedDB open failed:", err);
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[storage] put ${store}/${key} failed:`, err);
  }
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    if (!db) return undefined;
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbDelete(store: string, key: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

async function idbAll<T>(store: string): Promise<T[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export const idb = {
  put: idbPut,
  get: idbGet,
  delete: idbDelete,
  all: idbAll,
};

// ── localStorage helpers (safe under SSR/private mode) ──
export function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
