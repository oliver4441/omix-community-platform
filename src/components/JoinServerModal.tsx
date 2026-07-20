import { useState } from 'react';
import { Store } from '../utils/store';

export function JoinServerModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (serverId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const serverId = await Store.joinServerByInvite(code.trim());
      if (serverId) {
        onJoined(serverId);
      } else {
        setError('Invalid invite code');
      }
    } catch {
      setError('Failed to join server');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-sidebar)] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeSlideUp 0.3s ease' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Join a Server</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
            ✕
          </button>
        </div>

        <form onSubmit={handleJoin}>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
            Invite Code
          </label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)}
            placeholder="Paste invite code"
            className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 mb-4 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700"
            autoFocus
          />

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button type="submit" disabled={loading || !code.trim()}
            className="btn-accent w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]">
            {loading ? 'Joining...' : 'Join Server'}
          </button>
        </form>

        <p className="text-center mt-4 text-xs text-[var(--text-muted)]">
          Ask the server admin for an invite code
        </p>
      </div>
    </div>
  );
}
