"use client";

import { X, Search, Hash, Users, Globe, FileText, Calendar, MessageSquare, Loader2, AlertCircle } from "@/components/ui/icons";
import { useState, useEffect, useRef, useCallback } from "react";
import { Store } from "@/lib/store";
import type { SearchResultItem } from "@/lib/services/search";

interface SearchModalProps {
  onClose: () => void;
}

const FILTER_CHIPS: { label: string; token: string }[] = [
  { label: "has:image", token: "has:image" },
  { label: "has:file", token: "has:file" },
  { label: "has:link", token: "has:link" },
  { label: "has:reply", token: "has:reply" },
  { label: "has:pinned", token: "has:pinned" },
];

const KIND_META: Record<string, { icon: typeof Hash; label: string }> = {
  message: { icon: MessageSquare, label: "Messages" },
  thread: { icon: MessageSquare, label: "Threads" },
  user: { icon: Users, label: "People" },
  server: { icon: Globe, label: "Communities" },
  channel: { icon: Hash, label: "Channels" },
  file: { icon: FileText, label: "Files" },
  event: { icon: Calendar, label: "Events" },
};

export function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const runSearch = useCallback(async (raw: string) => {
    if (!raw.trim()) {
      setResults([]);
      setSearched(false);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await Store.search.search(raw, 30);
      setResults(res.results);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search (300ms) — global search hits the backend.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void runSearch(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, runSearch]);

  const openResult = useCallback(
    (r: SearchResultItem) => {
      const ctx = r.context || {};
      if (ctx.serverId) {
        Store.currentServerId = ctx.serverId;
        window.dispatchEvent(new CustomEvent("serverChanged", { detail: ctx.serverId }));
      }
      if (ctx.channelId) {
        Store.currentChannelId = ctx.channelId;
        window.dispatchEvent(new CustomEvent("channelChanged", { detail: ctx.channelId }));
        window.dispatchEvent(new CustomEvent("navigateChat", { detail: ctx.channelId }));
      }
      onClose();
    },
    [onClose]
  );

  const appendChip = (token: string) => {
    setQuery((q) => (q.includes(token) ? q : `${q} ${token}`.trim()));
    inputRef.current?.focus();
  };

  // Group results by kind, preserving order.
  const groups: { kind: string; items: SearchResultItem[] }[] = [];
  for (const r of results) {
    const last = groups[groups.length - 1];
    if (last && last.kind === r.kind) last.items.push(r);
    else groups.push({ kind: r.kind, items: [r] });
  }

  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] z-[9999] flex items-start justify-center pt-14 md:pt-20 px-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Search Omix"
    >
      <div className="w-full max-w-xl bg-[var(--color-bg-dark)] rounded-[20px] shadow-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search size={18} className="text-[var(--color-txt-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, people, channels… (try from:, in:, has:image)"
            className="flex-1 bg-transparent text-[var(--color-txt)] placeholder-[var(--color-txt-muted)] outline-none text-sm min-w-0"
            aria-label="Search query"
          />
          {loading && <Loader2 size={16} className="animate-spin text-[var(--color-pri)] shrink-0" />}
          <button onClick={onClose} className="btn-icon" aria-label="Close search">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1.5 px-4 py-2 border-b border-[var(--color-border)] overflow-x-auto no-scrollbar">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.token}
              onClick={() => appendChip(chip.token)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
                query.includes(chip.token)
                  ? "border-[var(--color-pri)] bg-[var(--color-pri-muted)] text-[var(--color-pri)]"
                  : "border-[var(--color-border)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)]"
              }`}
            >
              {chip.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-[var(--color-txt-muted)] self-center shrink-0 hidden md:block">
            filters: from: in: before: after: has:
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 m-4 p-3 rounded-[12px] bg-red-500/10 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}
          {!error && searched && !loading && results.length === 0 && (
            <div className="p-10 text-center">
              <Search size={28} className="mx-auto text-[var(--color-txt-muted)] mb-3" />
              <p className="text-sm text-[var(--color-txt-muted)]">
                No results for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs text-[var(--color-txt-muted)] mt-1">
                Search covers messages, threads, people, communities, channels, files and events.
              </p>
            </div>
          )}
          {!error && !searched && !loading && (
            <div className="p-6 text-center text-xs text-[var(--color-txt-muted)]">
              Search everything in Omix — communities, channels, messages, files and events.
            </div>
          )}
          {groups.map((group) => {
            const meta = KIND_META[group.kind] || KIND_META.message;
            const Icon = meta.icon;
            return (
              <div key={group.kind}>
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-txt-muted)] flex items-center gap-1.5">
                  <Icon size={12} />
                  {meta.label}
                </div>
                {group.items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openResult(r)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-hover)] transition-colors flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-[10px] bg-[var(--color-bg-mid)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-[var(--color-pri)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--color-txt)] line-clamp-2 break-words">
                        {r.kind === "channel" ? r.title : r.title}
                      </p>
                      {r.snippet && (
                        <p className="text-xs text-[var(--color-txt-muted)] line-clamp-1 mt-0.5">
                          {r.snippet}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--color-txt-muted)] mt-0.5">
                        {r.by ? `${r.by} · ` : ""}
                        {r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
