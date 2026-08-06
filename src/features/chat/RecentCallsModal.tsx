"use client";

import { useEffect, useState } from "react";
import { Store } from "@/lib/store";
import type { CallLogEntry } from "@/lib/types";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Video,
  X,
} from "@/components/ui/icons";

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(ts: Date | { toDate: () => Date }): string {
  const date = ts instanceof Date ? ts : ts.toDate();
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): { label: string; color: string; missed: boolean } {
  switch (status) {
    case "ended":
      return { label: "Completed", color: "var(--color-success)", missed: false };
    case "missed":
    case "no-answer":
      return { label: "Missed", color: "var(--color-dnd)", missed: true };
    case "declined":
      return { label: "Declined", color: "var(--color-dnd)", missed: false };
    case "canceled":
      return { label: "Canceled", color: "var(--color-txt-muted)", missed: false };
    case "failed":
      return { label: "Failed", color: "var(--color-dnd)", missed: false };
    case "ringing":
      return { label: "In progress", color: "var(--color-pri)", missed: false };
    default:
      return { label: status, color: "var(--color-txt-muted)", missed: false };
  }
}

export function RecentCallsModal({
  onClose,
  onOpenPartner,
}: {
  onClose: () => void;
  onOpenPartner: (userId: string) => void;
}) {
  const [entries, setEntries] = useState<CallLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = Store.subscribeCallLog((log) => {
      setEntries(log);
      setLoaded(true);
    });
    return () => {
      unsub();
    };
  }, []);

  const me = Store.sessionId;

  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Recent calls"
    >
      <div
        className="bg-[var(--color-bg-dark)] rounded-[20px] w-96 max-w-[92vw] shadow-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.15s ease" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-[var(--color-txt)]">
            Recent Calls
          </h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close recent calls">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 pb-3">
          {!loaded ? (
            <div className="px-3 py-6 space-y-2" aria-label="Loading call history">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12 rounded-[16px]" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6">
              <div className="w-12 h-12 rounded-full bg-[var(--color-bg-mid)] flex items-center justify-center mb-3">
                <Phone size={22} className="text-[var(--color-txt-muted)] opacity-50" />
              </div>
              <p className="text-sm text-[var(--color-txt-muted)]">
                No calls yet
              </p>
              <p className="text-xs text-[var(--color-txt-muted)] mt-1 opacity-70">
                Voice and video calls will show up here
              </p>
            </div>
          ) : (
            <ul role="list" aria-label="Call history">
              {entries.map((entry) => {
                const isOutgoing = entry.callerId === me;
                const partnerName = isOutgoing
                  ? entry.calleeName || "Unknown"
                  : entry.callerName || "Unknown";
                const outcome = statusLabel(entry.status);
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => onOpenPartner(isOutgoing ? entry.calleeId : entry.callerId)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                      aria-label={`${outcome.label} ${entry.video ? "video" : "voice"} call with ${partnerName}`}
                    >
                      <div
                        className="w-10 h-10 rounded-full bg-[var(--color-bg-mid)] flex items-center justify-center shrink-0"
                        style={{ color: outcome.color }}
                      >
                        {outcome.missed ? (
                          <PhoneMissed size={18} />
                        ) : isOutgoing ? (
                          <PhoneIncoming size={18} className="rotate-180" />
                        ) : (
                          <PhoneIncoming size={18} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium text-sm text-[var(--color-txt)]">
                            {partnerName}
                          </span>
                          <span className="text-[10px] text-[var(--color-txt-muted)] whitespace-nowrap ml-2">
                            {formatTime(entry.startedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-txt-muted)]">
                          <span style={{ color: outcome.color }}>{outcome.label}</span>
                          <span>·</span>
                          <span>{entry.video ? "Video" : "Voice"}</span>
                          <span>·</span>
                          <span>{formatDuration(entry.durationMs)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-center gap-1.5 text-xs text-[var(--color-txt-muted)]">
          <Video size={13} />
          Calls are logged automatically
        </div>
      </div>
    </div>
  );
}
