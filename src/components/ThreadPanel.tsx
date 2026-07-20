import { useState, useEffect, useRef } from 'react';
import { Store, getSessionId } from '../utils/store';
import { renderFormattedText } from '../utils/format';
import type { Message } from '../types';
import { Icon } from './Icon';

function formatTime(ts: Date | { toDate: () => Date }): string {
  const d = ts instanceof Date ? ts : ts.toDate();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ThreadPanel({
  parentMessage,
  onClose,
  displayName,
}: {
  parentMessage: Message;
  onClose: () => void;
  displayName: string;
}) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = Store.subscribeThread(parentMessage.id, (_, data) => {
      setReplies(data as Message[]);
    });
    inputRef.current?.focus();
    return unsub;
  }, [parentMessage.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    Store.sendMessage(Store.currentChannelId, input.trim(), displayName, {
      replyTo: { id: parentMessage.id, author: parentMessage.author, text: parentMessage.text, color: parentMessage.color },
      threadId: parentMessage.id,
    });
    setInput('');
  };

  return (
    <div className="w-[340px] max-md:w-full max-md:absolute max-md:inset-0 max-md:z-50 bg-[var(--bg-sidebar)] h-full flex flex-col border-l border-[var(--bg-rail)] shrink-0"
      style={{ animation: 'slideIn 0.2s ease' }}
      data-name="thread-panel">
      
      {/* Header */}
      <div className="h-12 border-b border-[var(--bg-rail)] flex items-center px-4 gap-2 shrink-0">
        <Icon name="message-circle" size={18} className="text-[var(--accent)]" />
        <span className="font-bold text-sm text-[var(--text-primary)]">Thread</span>
        <button onClick={onClose}
          className="ml-auto w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-[var(--bg-rail)]">
        <div className="flex gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: parentMessage.color || '#5865f2' }}>
            {(parentMessage.author || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold" style={{ color: parentMessage.color || '#5865f2' }}>
                {parentMessage.author}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {formatTime(parentMessage.timestamp)}
              </span>
            </div>
            <div className="text-sm text-[var(--text-primary)] mt-0.5 leading-relaxed break-words">
              {renderFormattedText(parentMessage.text || '')}
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto scroll-custom px-4 py-2 space-y-2">
        {replies.map(reply => {
          const isOwn = reply.sessionId === getSessionId();
          return (
            <div key={reply.id} className="flex gap-2.5 group">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5"
                style={{ backgroundColor: reply.color || '#5865f2' }}>
                {(reply.author || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold" style={{ color: reply.color || '#5865f2' }}>
                    {reply.author}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatTime(reply.timestamp)}
                  </span>
                  {isOwn && (
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                      <button onClick={() => Store.deleteMessage(reply.id)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-400 transition-all"
                        title="Delete">
                        <Icon name="trash" size={10} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-[var(--text-primary)] mt-0.5 leading-relaxed break-words">
                  {renderFormattedText(reply.text || '')}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply input */}
      <div className="p-3 border-t border-[var(--bg-rail)] shrink-0">
        <form onSubmit={sendReply} className="flex items-center gap-2">
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 bg-[#1e1f22] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] border border-gray-700" />
          <button type="submit" disabled={!input.trim()}
            className="w-9 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 flex items-center justify-center transition-all shrink-0">
            <Icon name="send" size={15} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
