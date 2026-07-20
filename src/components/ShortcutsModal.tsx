import { useEffect } from 'react';
import { Icon } from './Icon';

const shortcuts = [
  { keys: ['Ctrl', 'K'], desc: 'Search messages' },
  { keys: ['Ctrl', '/'], desc: 'Show keyboard shortcuts' },
  { keys: ['Enter'], desc: 'Send message' },
  { keys: ['Shift', 'Enter'], desc: 'New line in message' },
  { keys: ['Escape'], desc: 'Close modal / cancel reply' },
  { keys: ['↑'], desc: 'Edit last message (when input empty)' },
  { keys: ['Esc'], desc: 'Cancel edit / close emoji picker' },
  { keys: ['@'], desc: 'Mention a user' },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ animation: 'fadeIn 0.15s ease' }}>
      <div className="bg-[var(--bg-sidebar)] rounded-xl w-full max-w-md shadow-2xl border border-gray-700 overflow-hidden"
        style={{ animation: 'scaleIn 0.15s ease' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd className="bg-[#232428] text-[var(--text-primary)] text-xs font-mono px-2 py-1 rounded border border-gray-600 min-w-[24px] text-center inline-block">
                      {k}
                    </kbd>
                    {j < s.keys.length - 1 && <span className="text-[var(--text-muted)] mx-1 text-xs">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-700 text-[11px] text-[var(--text-muted)] text-center">
          Press <kbd className="bg-[#232428] text-[var(--text-primary)] text-xs font-mono px-1.5 py-0.5 rounded border border-gray-600">Ctrl</kbd> + <kbd className="bg-[#232428] text-[var(--text-primary)] text-xs font-mono px-1.5 py-0.5 rounded border border-gray-600">/</kbd> to open this again
        </div>
      </div>
    </div>
  );
}
