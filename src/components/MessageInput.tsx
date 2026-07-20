import { useRef, lazy, Suspense } from 'react';
import type { Message } from '../types';
import { Icon } from './Icon';

const EmojiPicker = lazy(() => import('./EmojiPicker').then(m => ({ default: m.EmojiPicker })));

interface MessageInputProps {
  channelName: string;
  input: string;
  showEmoji: boolean;
  setShowEmoji: (show: boolean) => void;
  showMentions: boolean;
  replyTo: Message['replyTo'] | null;
  setReplyTo: (reply: Message['replyTo'] | null) => void;
  sendMsg: (e: React.FormEvent) => void;
  handleInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  insertMention: (name: string) => void;
  addEmoji: (emoji: string) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  filteredMentions: string[];
}

export function MessageInput({
  channelName,
  input,
  showEmoji,
  setShowEmoji,
  showMentions,
  replyTo,
  setReplyTo,
  sendMsg,
  handleInput,
  insertMention,
  addEmoji,
  handleFileSelect,
  filteredMentions,
}: MessageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Reply indicator above input */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--bg-sidebar)] border-t border-[var(--bg-rail)] text-sm shrink-0">
          <Icon name="reply" size={14} className="text-[var(--accent)]" />
          <span className="text-xs text-[var(--text-muted)]">Replying to </span>
          <span className="text-xs font-semibold" style={{ color: replyTo.color }}>{replyTo.author}</span>
          <span className="text-xs text-[var(--text-muted)] truncate flex-1">{replyTo.text}</span>
          <button onClick={() => setReplyTo(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Message input */}
      <div className="px-4 py-3 bg-[var(--bg-chat)] border-t border-[var(--bg-rail)] shrink-0 relative">
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-4 mb-1 bg-[var(--bg-sidebar)] border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[180px]">
            {filteredMentions.map(name => (
              <button key={name} onClick={() => insertMention(name)}
                className="w-full px-3 py-2 text-sm text-left text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2">
                <Icon name="at-sign" size={14} className="text-[var(--text-muted)]" />
                {name}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={sendMsg} className="flex items-end gap-2">
          <div className="flex-1 flex items-center bg-[var(--chat-input)] rounded-xl px-3 border border-transparent focus-within:border-[var(--accent)] focus-within:bg-[var(--chat-input-focus)] transition-all">
            <button type="button" onClick={() => document.getElementById('file-input')?.click()}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0" aria-label="Attach file">
              <Icon name="paperclip" size={18} />
            </button>
            <input ref={inputRef} id="chat-input" type="text" value={input} onChange={handleInput}
              placeholder={`Message #${channelName}`}
              className="flex-1 bg-transparent border-none outline-none py-2.5 px-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] max-h-20"
              autoFocus />
            <input id="file-input" type="file" onChange={handleFileSelect} className="hidden" />
            <button type="button" onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0" aria-label="Toggle emoji picker">
              <Icon name="emoji" size={18} />
            </button>
          </div>
          <button type="submit" disabled={!input.trim()}
            className="w-10 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
            aria-label="Send message">
            <Icon name="send" size={18} className="text-white" />
          </button>
        </form>

        {/* Emoji picker */}
        {showEmoji && (
          <Suspense fallback={null}>
            <EmojiPicker
              onSelect={addEmoji}
              onClose={() => setShowEmoji(false)}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}