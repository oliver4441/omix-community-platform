import { useState, useEffect, useRef } from 'react';
import { useJitsiCall } from '../hooks/useJitsiCall';
import { Icon } from './Icon';

interface JitsiCallProps {
  callId: string;
  displayName: string;
  onClose: () => void;
  audioOnly?: boolean;
}

export function JitsiCall({ callId, displayName, onClose, audioOnly = false }: JitsiCallProps) {
  const {
    participants,
    localParticipant,
    isConnecting,
    error,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
    chatMessages,
  } = useJitsiCall();

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    joinCall(callId, displayName, { audioOnly });
  }, [callId, displayName, audioOnly, joinCall]);

  useEffect(() => {
    if (containerRef.current && !document.getElementById('jitsi-container')) {
      containerRef.current.id = 'jitsi-container';
    }
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  if (isConnecting) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="bg-[var(--bg-sidebar)] rounded-2xl p-8 text-center max-w-md mx-4">
          <div className="w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-white mb-2">Joining call...</h2>
          <p className="text-[var(--text-muted)]">Connecting to {callId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="bg-[var(--bg-sidebar)] rounded-2xl p-8 text-center max-w-md mx-4">
          <Icon name="alert-triangle" size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to join call</h2>
          <p className="text-[var(--text-muted)] mb-6">{error}</p>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" ref={containerRef}>
      {/* Top bar */}
      <div className="bg-black/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Leave call"
          >
            <Icon name="close" size={20} className="text-white" />
          </button>
          <div>
            <h1 className="font-bold text-white text-lg">{callId}</h1>
            <p className="text-xs text-white/60">{participants.length + 1} participant{participants.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Settings"
          >
            <Icon name="settings" size={20} className="text-white" />
          </button>
          <button 
            onClick={() => setShowChat(!showChat)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              showChat ? 'bg-[var(--accent)]' : 'bg-white/10 hover:bg-white/20'
            }`}
            aria-label="Chat"
          >
            <Icon name="message-square" size={20} className="text-white" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {chatMessages.length > 9 ? '9+' : chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 relative overflow-hidden">
        {/* Remote participants */}
        <div className="h-full w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-4">
          {/* Local participant preview */}
          <div className="relative bg-gray-900 rounded-xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              {localParticipant?.videoEnabled ? (
                <video 
                  ref={el => el && videoRefs.current.set('local', el)}
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
</div>
            <div className="absolute bottom-2 left-2 right-2 flex justify-between">
              <span className="bg-black/70 px-2 py-1 rounded text-xs text-white">{displayName} (You)</span>
              <div className="flex gap-1">
                <button 
                  onClick={toggleMute}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    localParticipant?.muted ? 'bg-red-500' : 'bg-white/20'
                  }`}
                  aria-label={localParticipant?.muted ? 'Unmute' : 'Mute'}
                >
                  <Icon name="phone" size={16} className="text-white" />
                </button>
                {!audioOnly && (
                  <button 
                    onClick={toggleVideo}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      !localParticipant?.videoEnabled ? 'bg-red-500' : 'bg-white/20'
                    }`}
                    aria-label={localParticipant?.videoEnabled ? 'Stop video' : 'Start video'}
                  >
                    <Icon name="camera" size={16} className="text-white" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Remote participants */}
          {participants.map((p, _i) => (
            <div key={p.id} className="relative bg-gray-900 rounded-xl overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                {p.videoEnabled ? (
                  <video 
                    ref={el => el && videoRefs.current.set(p.id, el)}
                    autoPlay 
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-white">
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                <span className="bg-black/70 px-2 py-1 rounded text-xs text-white">{p.displayName}</span>
                <div className="flex gap-1 justify-end">
                  {p.muted && (
                    <Icon name="phone" size={14} className="text-red-400" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {participants.length === 0 && (
          <div className="h-full w-full flex flex-col items-center justify-center text-white/60">
            <Icon name="users" size={64} className="mb-4 opacity-50" />
            <p className="text-lg">Waiting for participants...</p>
            <p className="text-sm mt-1">Share the call link to invite others</p>
          </div>
        )}
      </div>

{/* Bottom toolbar */}
      <div className="bg-black/80 backdrop-blur-sm px-4 py-3 flex items-center justify-center gap-4 border-t border-white/10">
        <button 
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            localParticipant?.muted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'
          }`}
          aria-label={localParticipant?.muted ? 'Unmute' : 'Mute'}
        >
          <Icon name="phone" size={24} className="text-white" />
        </button>
        
        {!audioOnly && (
          <button 
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              !localParticipant?.videoEnabled ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'
            }`}
            aria-label={localParticipant?.videoEnabled ? 'Stop video' : 'Start video'}
          >
            <Icon name="camera" size={24} className="text-white" />
          </button>
        )}
        
        <button 
          onClick={toggleScreenShare}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Share screen"
        >
          <Icon name="home" size={24} className="text-white" />
        </button>
        
        <div className="w-px h-8 bg-white/20 mx-2" />
        
        <button 
          onClick={leaveCall}
          className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          aria-label="Leave call"
        >
          <Icon name="phone" size={24} className="text-white" />
        </button>
      </div>

      {/* Chat sidebar */}
      {showChat && (
        <div className="fixed right-0 top-0 h-full w-80 md:w-96 bg-[var(--bg-sidebar)] border-l border-white/10 z-40 flex flex-col animate-slideIn">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-white">Chat</h3>
            <button 
              onClick={() => setShowChat(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <Icon name="close" size={18} className="text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-white text-sm">{msg.sender}</span>
                    <span className="text-xs text-white/40">{msg.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <p className="text-white/80 text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-white/5 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-white/10"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed right-0 top-0 h-full w-80 bg-[var(--bg-sidebar)] border-l border-white/10 z-40 flex flex-col animate-slideIn">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-white">Settings</h3>
            <button 
              onClick={() => setShowSettings(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <Icon name="close" size={18} className="text-white" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-3">Audio</h4>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked />
                <span className="text-white">Microphone: Default</span>
              </label>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-3">Video</h4>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked />
                <span className="text-white">Camera: Default</span>
              </label>
            </div>
            <div className="pt-4 border-t border-white/10">
              <button 
                onClick={leaveCall}
                className="w-full py-2 bg-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/30 transition-colors"
              >
                Leave Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}