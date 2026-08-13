/**
 * Connection service — single source of truth for online/offline state.
 *
 * Combines navigator.onLine (network reachability) with Ably's connection
 * state (realtime channel health). UI can render offline banners from here,
 * and services use it to pause polling / queue outbox messages.
 */
import { onAblyConnectionState } from "@/lib/ably";
import { publish } from "./events";

export type ConnectionStatus = "online" | "offline" | "reconnecting";

const listeners = new Set<(status: ConnectionStatus) => void>();

let browserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
let ablyConnected = false;
let status: ConnectionStatus = "online";

function computeStatus(): ConnectionStatus {
  if (!browserOnline) return "offline";
  if (!ablyConnected && typeof window !== "undefined") return "reconnecting";
  return "online";
}

function setStatus(next: ConnectionStatus) {
  if (next === status) return;
  const previous = status;
  status = next;
  publish("connection:status", { status, previous });
  for (const listener of [...listeners]) listener(status);
  if (status === "online" && previous !== "online") {
    publish("connection:restored", {});
  }
}

export function getConnectionStatus(): ConnectionStatus {
  return status;
}

export function isOnline(): boolean {
  return browserOnline;
}

export function onConnectionStatusChange(cb: (status: ConnectionStatus) => void): () => void {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

let initialized = false;

export function initConnectionService(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("online", () => {
    browserOnline = true;
    setStatus(computeStatus());
  });
  window.addEventListener("offline", () => {
    browserOnline = false;
    setStatus(computeStatus());
  });

  onAblyConnectionState((connected) => {
    ablyConnected = connected;
    setStatus(computeStatus());
  });
}
