import { useState, useEffect } from 'react';
import { Store } from '../utils/store';
import type { Server } from '../types';

export function ServerRail({ isMobile, currentView }: { isMobile: boolean; currentView: string }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsub = Store.subscribeServers((_, data) => setServers(data as Server[]));
    return unsub;
  }, []);

  const selectServer = (serverId: string) => {
    Store.currentServerId = serverId;
    Store.cleanup();
    Store.currentChannelId = '';
    window.dispatchEvent(new CustomEvent('serverChanged', { detail: serverId }));
  };

  const createServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    Store.createServer(newName.trim()).then(id => {
      selectServer(id);
      setShowCreate(false);
      setNewName('');
    });
  };

  const deleteServer = (e: React.MouseEvent, serverId: string, name: string) => {
    e.stopPropagation();
    if (!Store.isAdmin) return;
    if (confirm(`Delete server "${name}"? All channels will be orphaned.`)) {
      Store.deleteServer(serverId);
    }
  };

  if (isMobile && currentView !== 'servers') return null;

  return (
    <div className="w-[72px] bg-[var(--bg-rail)] h-full flex flex-col items-center py-3 gap-2 overflow-y-auto scroll-custom z-10 shrink-0" data-name="server-rail" data-file="components/ServerRail.tsx">
      <div className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] flex items-center justify-center cursor-pointer transition-all duration-200 group relative overflow-hidden">
        <img src="logo.jpg" className="w-full h-full object-cover" alt="Home" />
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full hidden group-hover:block" />
      </div>

      <div className="w-8 h-[2px] bg-[var(--bg-hover)] my-1 rounded-full" />

      {servers.map(server => {
        const isActive = Store.currentServerId === server.id;
        return (
          <div
            key={server.id}
            onClick={() => selectServer(server.id)}
            className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden relative group ${
              isActive ? 'rounded-[16px] bg-[var(--accent)]' : 'bg-[var(--bg-chat)]'
            }`}
            title={server.name}
          >
            {server.icon
              ? <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
              : <span className="text-[var(--text-primary)] text-sm font-medium">{server.name.charAt(0).toUpperCase()}</span>}
            <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full ${isActive ? 'block' : 'hidden group-hover:block'}`} />
            {Store.isAdmin && (
              <button
                onClick={e => deleteServer(e, server.id, server.name)}
                className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] opacity-0 group-hover:opacity-100 hover:scale-110 transition-all"
                title="Delete server"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      <div
        onClick={() => setShowCreate(true)}
        className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] flex items-center justify-center text-[#23a559] hover:bg-[#23a559] hover:text-white cursor-pointer transition-all duration-200 mt-2"
      >
        <svg className="icon-plus text-2xl" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="bg-[var(--bg-sidebar)] rounded-xl p-6 w-80 shadow-2xl border border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Create Server</h2>
            <form onSubmit={createServer}>
              <input
                type="text"
                placeholder="Server name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 mb-4 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-accent px-4 py-2 rounded-lg flex-1 font-semibold">Create</button>
                <button type="button" onClick={() => { setShowCreate(false); setNewName(''); }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}