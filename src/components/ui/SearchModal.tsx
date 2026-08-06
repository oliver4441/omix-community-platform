"use client";

import { X, Search } from "@/components/ui/icons";
import { useState, useEffect, useMemo, useRef } from "react";
import { Store } from "@/lib/store";

interface SearchModalProps {
  onClose: () => void;
}

export function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return Store.messages
      .filter((m) => m.text.toLowerCase().includes(q))
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        text: m.text,
        author: m.author,
        channelName: Store.channels.find((c) => c.id === m.channelId)?.name || "Unknown",
      }));
  }, [query]);

  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] z-[9999] flex items-start justify-center pt-20"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-[var(--color-bg-dark)] rounded-[20px] shadow-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search size={18} className="text-[var(--color-txt-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-[var(--color-txt)] placeholder-[var(--color-txt-muted)] outline-none text-sm"
          />
          <button onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.map((r) => (
              <div
                key={r.id}
                className="px-3 py-2.5 rounded-[12px] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
              >
                <p className="text-sm text-[var(--color-txt)] line-clamp-2">{r.text}</p>
                <p className="text-xs text-[var(--color-txt-muted)] mt-1">
                  {r.author} &middot; #{r.channelName}
                </p>
              </div>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="p-8 text-center text-sm text-[var(--color-txt-muted)]">
            No messages found for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
