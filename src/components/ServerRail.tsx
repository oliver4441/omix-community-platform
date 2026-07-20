import { useState, useEffect, useRef } from 'react';
import { Store } from '../utils/store';
import type { Server } from '../types';
import { ServerSettingsModal } from './ServerSettingsModal';
import { JoinServerModal } from './JoinServerModal';
import { Icon } from './Icon';
import { useToast } from './Toast';

export function ServerRail({ isMobile, currentView, onDMClick }: { isMobile: boolean; currentView: string; onDMClick: () => void }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newName, setNewName] = useState('');
  const [settingsServerId, setSettingsServerId] = useState<string | null>(null);
  const [newIconFile, setNewIconFile] = useState<File | null>(null);
  const [newIconPreview, setNewIconPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = await Store.createServer(newName.trim());
    if (newIconFile) {
      try {
        await Store.uploadServerIcon(newIconFile, id);
      } catch (err) {
        console.error('Icon upload failed:', err);
      }
    }
    setShowCreate(false);
    setNewName('');
    setNewIconFile(null);
    setNewIconPreview('');
    selectServer(id);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Image too large (max 2MB)', 'error');
      return;
    }
    setNewIconFile(file);
    setNewIconPreview(URL.createObjectURL(file));
  };

  const handleJoined = (serverId: string) => {
    setShowJoin(false);
    selectServer(serverId);
  };

  if (isMobile && currentView !== 'servers') return null;

  return (
    <div className="w-[72px] bg-[var(--bg-rail)] h-full flex flex-col items-center py-3 gap-2 overflow-y-auto scroll-custom z-10 shrink-0" data-name="server-rail" data-file="components/ServerRail.tsx">
      {/* Home/DM */}
      <div className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] flex items-center justify-center cursor-pointer transition-all duration-200 group relative overflow-hidden">
        <img src="logo.jpg" className="w-full h-full object-cover" alt="Home" />
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full hidden group-hover:block" />
      </div>

      <button
        onClick={onDMClick}
        className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden relative group ${
          currentView === 'dms' ? 'rounded-[16px] bg-[var(--accent)]' : 'bg-[var(--bg-chat)]'
        }`}
        title="Direct Messages"
      >
        <Icon name="message-square" size={20} className={currentView === 'dms' ? 'text-white' : 'text-[var(--text-muted)]'} />
        <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full ${currentView === 'dms' ? 'block' : 'hidden group-hover:block'}`} />
      </button>

      <div className="w-8 h-[2px] bg-[var(--bg-hover)] my-1 rounded-full" />

      {/* Server list */}
      {servers.map(server => {
        const isActive = Store.currentServerId === server.id;
        return (
          <div key={server.id}
            className="relative group">
            <div
              onClick={() => selectServer(server.id)}
              className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden relative ${
                isActive ? 'rounded-[16px] bg-[var(--accent)]' : 'bg-[var(--bg-chat)]'
              }`}
              title={server.name}
            >
              {server.icon
                ? <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                : <span className="text-[var(--text-primary)] text-sm font-medium">{server.name.charAt(0).toUpperCase()}</span>}
              <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full ${isActive ? 'block' : 'hidden group-hover:block'}`} />
            </div>
            {/* Settings gear on hover */}
            <button
              onClick={(e) => { e.stopPropagation(); setSettingsServerId(server.id); }}
              className="absolute bottom-0 right-0 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:scale-110 transition-all hover:bg-[var(--accent)]"
              title="Server settings"
              aria-label={`Server settings for ${server.name}`}
            >
              <Icon name="settings" size={10} />
            </button>
          </div>
        );
      })}

      {/* Add server menu - admin only */}
      {Store.isAdmin && (
        <div className="relative">
          <div
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] flex items-center justify-center text-[#23a559] hover:bg-[#23a559] hover:text-white cursor-pointer transition-all duration-200 mt-2"
          >
            <Icon name="plus" size={24} />
          </div>

          {showAddMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
              <div className="absolute left-[72px] bottom-0 bg-[var(--bg-sidebar)] rounded-xl shadow-2xl border border-gray-700 z-50 py-1 min-w-[180px]"
                style={{ animation: 'scaleIn 0.12s ease' }}>
                <button onClick={() => { setShowAddMenu(false); setShowCreate(true); }}
                  className="w-full px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] text-left flex items-center gap-3 transition-colors">
                  <Icon name="plus" size={16} className="text-[#23a559]" />
                  Create Server
                </button>
                <button onClick={() => { setShowAddMenu(false); setShowJoin(true); }}
                  className="w-full px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] text-left flex items-center gap-3 transition-colors">
                  <Icon name="users" size={16} className="text-[var(--accent)]" />
                  Join Server
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Server Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="bg-[var(--bg-sidebar)] rounded-xl p-6 w-80 shadow-2xl border border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Create Server</h2>
            <form onSubmit={handleCreate}>
              {/* Icon upload */}
              <div className="flex justify-center mb-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {newIconPreview ? (
                    <img src={newIconPreview} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[#1e1f22] flex items-center justify-center text-[var(--text-muted)]">
                      <Icon name="image" size={24} />
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
              </div>
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
                <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setNewIconFile(null); setNewIconPreview(''); }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] px-4 py-2">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Server Settings Modal */}
      {settingsServerId && (
        <ServerSettingsModal
          serverId={settingsServerId}
          onClose={() => setSettingsServerId(null)}
        />
      )}

      {showJoin && <JoinServerModal onClose={() => setShowJoin(false)} onJoined={handleJoined} />}
    </div>
  );
}
