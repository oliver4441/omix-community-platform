import { useState, useEffect, useRef } from 'react';
import { Store } from '../utils/store';
import type { Message } from '../types';
import { Icon } from './Icon';

export function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIdx]) {
        scrollToMessage(results[selectedIdx]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [results, selectedIdx, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const timer = setTimeout(() => {
      const matches = Store.messages.filter(m =>
        m.text.toLowerCase().includes(q) &&
        !m.pinned
      ).slice(0, 50);
      setResults(matches);
      setSelectedIdx(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const scrollToMessage = (msg: Message) => {
    onClose();
    // Scroll to message after modal closes
    setTimeout(() => {
      const el = document.getElementById(`msg-${msg.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('ring-2', 'ring-[var(--accent)]', 'ring-opacity-50');
      setTimeout(() => el?.classList.remove('ring-2', 'ring-[var(--accent)]', 'ring-opacity-50'), 2000);
    }, 100);
  };

  const formatTime = (ts: unknown): string => {
    if (!ts) return '';
    const d = ts instanceof Date ? ts : typeof ts === 'object' && ts !== null && 'toDate' in ts ? (ts as { toDate: () => Date }).toDate() : new Date(String(ts));
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ animation: 'fadeIn 0.15s ease' }}>
      <div className="bg-[var(--bg-sidebar)] w-full max-w-lg rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
        style={{ animation: 'scaleIn 0.15s ease' }}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <Icon name="search" size={20} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="bg-transparent border-none outline-none text-[var(--text-primary)] w-full placeholder-[var(--text-muted)] text-sm"
          />
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1" aria-label="Close search">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto scroll-custom">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
              No messages found for "{query}"
            </div>
          )}
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
              Type to search messages in this channel
            </div>
          )}
          {results.map((msg, i) => (
            <button
              key={msg.id}
              onClick={() => scrollToMessage(msg)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-hover)] ${
                i === selectedIdx ? 'bg-[var(--bg-hover)]' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: msg.color || '#5865f2' }}>
                {(msg.author || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{msg.author}</span>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="text-sm text-[var(--text-muted)] truncate">{msg.text}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-700 text-[10px] text-[var(--text-muted)] flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Esc Close</span>
          </div>
        )}
      </div>
    </div>
  );
}
