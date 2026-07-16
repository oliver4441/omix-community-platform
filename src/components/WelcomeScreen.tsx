import { useState, useEffect, FormEvent } from 'react';
import { Store } from '../utils/store';

export function WelcomeScreen({ onEnter }: { onEnter: (name: string) => void }) {
  const [name, setName] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const unsub = Store.subscribePresence((users) => setOnlineCount(users.length));
    return unsub;
  }, []);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');

    if (showAdmin && password.trim()) {
      const ok = await Store.verifyAdminPassword(password.trim());
      if (ok) {
        Store.isAdmin = true;
        onEnter(trimmed);
      } else {
        setError('Incorrect admin password');
        setLoading(false);
      }
    } else {
      if (showAdmin && !password.trim()) {
        setError('Enter the admin password');
        setLoading(false);
        return;
      }
      onEnter(trimmed);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f0f13 0%, #1a1b2e 30%, #1e1f22 60%, #0f0f13 100%)' }}>
      <div className="fixed inset-0 animate-gradient pointer-events-none opacity-30"
        style={{ background: 'linear-gradient(135deg, #520ff6 0%, transparent 30%, #7c3af0 50%, transparent 70%, #520ff6 100%)', backgroundSize: '200% 200%' }} />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle, #520ff6 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <div className="bg-[var(--bg-sidebar)] rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-800 relative animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="text-center mb-6">
          <img src="/logo.jpg"
            className="w-24 h-24 rounded-2xl mx-auto mb-4 shadow-lg object-cover"
            alt="Omix Community" style={{ boxShadow: '0 8px 32px rgba(82,15,246,0.3)' }} />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Omix Community</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Join the conversation</p>
        </div>

        <div className="bg-[#232428] rounded-lg px-4 py-2 mb-6 flex items-center justify-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--online)]" style={{ animation: 'pulse 2s ease infinite' }} />
            <span className="text-[var(--text-muted)]">{onlineCount} online now</span>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Display Name</label>
            <input type="text" onChange={e => setName(e.target.value)}
              className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 mt-1 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all"
              placeholder="Your name" required maxLength={20} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="adminToggle" onChange={e => { setShowAdmin(e.target.checked); setError(''); }}
              className="w-4 h-4 rounded accent-[var(--accent)]" />
            <label htmlFor="adminToggle" className="text-sm text-[var(--text-muted)] cursor-pointer">Sign in as admin</label>
          </div>

          {showAdmin && (
            <div className="animate-fade-up">
              <input type="password" onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all"
                placeholder="Admin password" />
            </div>
          )}

          {error && <p className="text-red-400 text-sm animate-fade-up">{error}</p>}

          <button type="submit" disabled={loading}
            className={`btn-accent w-full p-3 rounded-lg font-semibold text-base disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
                Verifying...
              </span>
            ) : 'Join Community'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-[var(--text-muted)]">Built on Firebase — Real-time community chat</p>
      </div>
    </div>
  );
}