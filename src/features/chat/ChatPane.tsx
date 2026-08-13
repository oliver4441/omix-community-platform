'use client';

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { ImageLightbox } from './ImageLightbox';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { RightSidebar } from './RightSidebar';
import { Store } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { initiateCall, setActiveChannel } from '@/lib/calls';
import { NotificationCenter } from '@/features/notifications/NotificationCenter';
import type { Message, User, TypingUser } from '@/lib/types';
import {
  Hash,
  MessageSquare,
  MessageCircle,
  Pin,
  Search,
  ChevronLeft,
  Edit3,
  Phone,
  Video,
  Menu,
  WifiOff,
  AlertCircle,
  RefreshCw,
} from '@/components/ui/icons';

const ThreadPanel = lazy(() =>
  import('./ThreadPanel').then((m) => ({ default: m.ThreadPanel }))
);
const SearchModal = lazy(() =>
  import('@/components/ui/SearchModal').then((m) => ({ default: m.SearchModal }))
);
const MobileChannelDrawer = lazy(() =>
  import('@/features/navigation/MobileChannelDrawer').then((m) => ({
    default: m.MobileChannelDrawer,
  }))
);

const MENTION_RE = /@(\w*)$/;

function parseDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts)
    return (ts as { toDate: () => Date }).toDate();
  return new Date(String(ts));
}

function formatDateSeparator(ts: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return ts.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: ts.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function shouldShowDateSeparator(
  prevMsg: Message | undefined,
  msg: Message
): string | null {
  if (!prevMsg) return formatDateSeparator(parseDate(msg.timestamp));
  const prevDate = parseDate(prevMsg.timestamp);
  const currDate = parseDate(msg.timestamp);
  const prevDay = new Date(
    prevDate.getFullYear(),
    prevDate.getMonth(),
    prevDate.getDate()
  );
  const currDay = new Date(
    currDate.getFullYear(),
    currDate.getMonth(),
    currDate.getDate()
  );
  if (currDay.getTime() !== prevDay.getTime()) {
    return formatDateSeparator(currDate);
  }
  return null;
}

function shouldShowAvatar(prevMsg: Message | undefined, msg: Message): boolean {
  if (!prevMsg) return true;
  return prevMsg.sessionId !== msg.sessionId;
}

export function ChatPane({
  isMobile,
  currentView,
  displayName,
}: {
  isMobile: boolean;
  currentView: string;
  displayName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [channelName, setChannelName] = useState('general');
  const [isDM, setIsDM] = useState(Store.currentChannelType === 'dm');
  const [dmName, setDmName] = useState(Store.currentDMChannelName);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyTo, setReplyTo] = useState<Message['replyTo'] | null>(null);
  const [pins, setPins] = useState<Message[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<
    Record<string, { name: string; avatar: string; color: string }>
  >({});
  const [showSearch, setShowSearch] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [connStatus, setConnStatus] = useState<'online' | 'offline' | 'reconnecting'>('online');
  const [msgStatus, setMsgStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; percent: number } | null>(null);
  const { toast } = useToast();
  const prevMsgCount = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load author profiles
  const loadAuthorProfiles = useCallback(async (msgs: Message[]) => {
    const authorIds = new Set(msgs.map((m) => m.sessionId).filter(Boolean));
    for (const sid of authorIds) {
      if (!sid) continue;
      setProfiles((prev) => {
        if (prev[sid]) return prev;
        Store.getProfile(sid).then((p) => {
          if (p)
            setProfiles((prev2) => ({ ...prev2, [sid]: p }));
        });
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    const channelId = Store.currentChannelId;
    if (!channelId) return;

    setActiveChannel(channelId);

    const unsubMsg = Store.subscribeMessages(channelId, (_, data) => {
      const msgs = data as Message[];
      prevMsgCount.current = msgs.length;
      setMessages(msgs);
      setMessagesLoaded(true);
      loadAuthorProfiles(msgs);
    });
    const unsubTyping = Store.subscribeTyping(channelId, setTypingUsers);
    const unsubPins = Store.subscribePins(channelId, setPins);
    const unsubPresence = Store.subscribePresence(setOnlineUsers);
    const offConn = Store.onConnectionChange(setConnStatus);
    const offStatus = Store.on('messagesStatus', (_, data) => {
      const { channelId: chId, status } = data as { channelId: string; status: 'loading' | 'ready' | 'error' };
      if (chId === channelId) setMsgStatus(status);
    });

    Store.markChannelRead(channelId);

    const handler = (e: CustomEvent) => {
      Store.cleanupChannel();
      Store.markChannelRead(e.detail);
      setActiveChannel(e.detail);
      setMsgStatus(Store.getMessageStatus(e.detail));
      Store.subscribeMessages(e.detail, (_, data) => {
        const msgs = data as Message[];
        setMessages(msgs);
        setMessagesLoaded(true);
        loadAuthorProfiles(msgs);
      });
      Store.subscribeTyping(e.detail, setTypingUsers);
      Store.subscribePins(e.detail, setPins);
      Store.subscribePresence(setOnlineUsers);
      const ch = Store.channels.find((c) => c.id === e.detail);
      if (ch) setChannelName(ch.name);
      setIsDM(Store.currentChannelType === 'dm');
      setDmName(Store.currentDMChannelName);
      setShowEmoji(false);
      setReplyTo(null);
    };
    window.addEventListener('channelChanged', handler as EventListener);
    return () => {
      setActiveChannel(null);
      unsubMsg();
      unsubTyping();
      unsubPins();
      unsubPresence();
      offConn();
      offStatus();
      window.removeEventListener('channelChanged', handler as EventListener);
    };
  }, [loadAuthorProfiles]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Drafts: restore on channel switch, persist (debounced) while typing ──
  // The channel id is read during render; ChatPane always re-renders on channel
  // changes (the channelChanged handler sets state), so these effects re-run.
  const draftChannelId = Store.currentChannelId;

  useEffect(() => {
    if (!draftChannelId) return;
    let cancelled = false;
    Store.getDraft(draftChannelId)
      .then((draft) => {
        if (!cancelled && draft) {
          setInput(draft.text);
          if (draft.replyTo) setReplyTo(draft.replyTo as Message["replyTo"]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftChannelId, isDM]);

  useEffect(() => {
    if (!draftChannelId) return;
    const timer = setTimeout(() => {
      // Guard against a channel switch that happened while debouncing.
      if (Store.currentChannelId !== draftChannelId) return;
      if (input.trim()) {
        void Store.saveDraft(draftChannelId, input, replyTo || undefined);
      } else {
        void Store.clearDraft(draftChannelId);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input, replyTo, draftChannelId]);

  const sendMsg = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      const opts: { replyTo?: Message['replyTo'] } = {};
      if (replyTo)
        opts.replyTo = {
          id: replyTo.id,
          author: replyTo.author,
          text: replyTo.text.substring(0, 80),
        };
      const channelId = Store.currentChannelId;
      Store.stopTyping(channelId);
      Store.sendMessage(channelId, input, displayName || 'Anonymous', opts)
        .catch((err) => {
          const code = (err as { code?: string })?.code;
          if (code === "flood_protected") {
            toast("You're sending messages too quickly — slow down", "error");
          } else if (code === "muted") {
            toast("You're muted in this channel", "error");
          } else {
            toast("Message couldn't be sent", "error");
          }
        });
      setInput('');
      setReplyTo(null);
      void Store.clearDraft(channelId);
    },
    [input, replyTo, displayName, toast]
  );

  const startCall = useCallback(
    (video: boolean) => {
      const channelId = Store.currentChannelId;
      if (Store.currentChannelType === 'dm') {
        const dm = Store.dmChannels.find((d) => d.id === channelId);
        const partnerId = dm?.participants.find((p) => p !== Store.sessionId);
        if (!partnerId) {
          toast('No one to call in this DM', 'info');
          return;
        }
        const partner = Store.onlineUsers.find((u) => u.id === partnerId);
        initiateCall(
          partnerId,
          partner?.name || dm?.participantNames?.[partnerId] || 'Guest',
          video
        );
      } else {
        const partner = Store.onlineUsers.find((u) => u.id !== Store.sessionId);
        if (!partner) {
          toast('No one else is online right now', 'info');
          return;
        }
        initiateCall(partner.id, partner.name, video);
      }
    },
    [toast]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);
      if (val.trim())
        Store.startTyping(Store.currentChannelId, displayName || 'Anonymous');
      else Store.stopTyping(Store.currentChannelId);

      const cursorPos = e.target.selectionStart ?? 0;
      const beforeCursor = val.substring(0, cursorPos);
      const match = beforeCursor.match(MENTION_RE);
      if (match) {
        setMentionQuery(match[1].toLowerCase());
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    },
    [displayName]
  );

  const insertMention = useCallback(
    (name: string) => {
      const cursorPos = inputRef.current?.selectionStart ?? 0;
      const before = input.substring(0, cursorPos);
      const after = input.substring(cursorPos);
      const match = before.match(MENTION_RE);
      if (match) {
        const newVal =
          before.substring(0, before.length - match[0].length) +
          '@' +
          name +
          ' ' +
          after;
        setInput(newVal);
      }
      setShowMentions(false);
      inputRef.current?.focus();
    },
    [input]
  );

  const addEmoji = useCallback(
    (emoji: string) => {
      setInput(input + emoji);
      setShowEmoji(false);
      inputRef.current?.focus();
    },
    [input]
  );

  const toggleReaction = useCallback(
    (msgId: string, emoji: string) =>
      Store.toggleReaction(msgId, emoji, displayName || 'Anonymous'),
    [displayName]
  );

  const startEdit = useCallback((msg: Message) => {
    setEditing(msg.id);
    setEditText(msg.text);
  }, []);

  const saveEdit = useCallback(
    (msgId: string) => {
      if (editText.trim()) Store.editMessage(msgId, editText);
      setEditing(null);
      setEditText('');
    },
    [editText]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        setShowDeleteConfirm('file-too-large');
        e.target.value = '';
        return;
      }
      setUploadProgress({ fileName: file.name, percent: 0 });
      Store.uploadFile(file, Store.currentChannelId, displayName || 'Anonymous', (p) =>
        setUploadProgress({ fileName: file.name, percent: p.percent })
      )
        .then(() => setUploadProgress(null))
        .catch(() => {
          setUploadProgress(null);
          setShowDeleteConfirm('upload-failed');
        });
      e.target.value = '';
    },
    [displayName]
  );

  const allNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...onlineUsers.map((u) => u.name),
          ...messages.map((m) => m.author).filter((a) => a !== displayName),
        ])
      ),
    [onlineUsers, messages, displayName]
  );

  const filteredMentions = useMemo(
    () =>
      showMentions && mentionQuery
        ? allNames
            .filter((n) => n.toLowerCase().includes(mentionQuery))
            .slice(0, 6)
        : [],
    [showMentions, mentionQuery, allNames]
  );

  const handleConfirmAction = useCallback(() => {
    if (
      showDeleteConfirm &&
      showDeleteConfirm !== 'file-too-large' &&
      showDeleteConfirm !== 'upload-failed'
    ) {
      Store.deleteMessage(showDeleteConfirm);
    }
    setShowDeleteConfirm(null);
  }, [showDeleteConfirm]);

  if (isMobile && currentView !== 'chat') return null;

  return (
    <div
      className="flex-1 flex min-w-0 bg-[var(--color-bg-deeper)]"
      data-name="chat-pane"
    >
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 shadow-sm shrink-0 bg-[var(--color-bg-dark)]">
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 -ml-1.5 mr-1 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
              aria-label="Open channels and communities"
            >
              <Menu size={18} className="text-[var(--color-txt-muted)]" />
            </button>
          )}
          {isDM ? (
            <MessageSquare
              size={18}
              className="text-[var(--color-txt-muted)] mr-2"
            />
          ) : (
            <Hash size={20} className="text-[var(--color-txt-muted)] mr-2" />
          )}
          <span className="font-bold text-[var(--color-txt)] mr-4">
            {isDM ? dmName : channelName}
          </span>
          <div className="w-px h-6 bg-[var(--color-border)] mx-2" />
          <span className="text-sm text-[var(--color-txt-muted)] truncate flex-1">
            {isDM ? dmName : `#${channelName}`}
          </span>
          {pins.length > 0 && (
            <div
              className="text-xs text-[var(--color-pri)] flex items-center gap-1 mr-2"
              title={`${pins.length} pinned message${pins.length > 1 ? 's' : ''}`}
            >
              <Pin size={14} />
              <span>{pins.length}</span>
            </div>
          )}
          <button
            onClick={() => startCall(false)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            aria-label="Start voice call"
            title="Start voice call"
          >
            <Phone
              size={18}
              className="text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors"
            />
          </button>
          <button
            onClick={() => startCall(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            aria-label="Start video call"
            title="Start video call"
          >
            <Video
              size={18}
              className="text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors"
            />
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            aria-label="Search messages"
          >
            <Search
              size={18}
              className="text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors"
            />
          </button>
          <NotificationCenter />
        </div>

        {/* Offline / reconnecting banner */}
        {connStatus !== "online" && (
          <div
            className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-400 flex items-center gap-2 shrink-0"
            role="status"
            aria-live="polite"
          >
            <WifiOff size={13} className="shrink-0" />
            {connStatus === "offline"
              ? "You're offline — messages are queued and will send when you reconnect."
              : "Reconnecting… messages are queued locally."}
          </div>
        )}

        {/* Pinned banner */}
        {pins.length > 0 && (
          <div className="bg-[var(--color-bg-mid)] border-b border-[var(--color-border)] px-4 py-2 text-sm flex items-center gap-2 shrink-0">
            <Pin size={14} className="text-[var(--color-pri)]" />
            <span className="font-bold text-[var(--color-pri)]">Pinned</span>
            <span className="text-[var(--color-txt-muted)] truncate">
              {pins[0].text.substring(0, 60)}
              {pins[0].text.length > 60 ? '...' : ''}
            </span>
            <span className="text-[var(--color-txt-muted)] text-xs">
              — {pins[0].author}
            </span>
            {pins.length > 1 && (
              <span className="text-[var(--color-txt-muted)] text-xs">
                + {pins.length - 1} more
              </span>
            )}
          </div>
        )}

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2 flex flex-col relative"
          id="messages-container"
          ref={messagesContainerRef}
          role="log"
          aria-label={`Messages in ${isDM ? dmName || 'direct messages' : `#${channelName}`}`}
          aria-live="polite"
          aria-relevant="additions"
        >
          {!messagesLoaded && msgStatus !== "error" ? (
            <div className="flex-1 px-2 py-4 space-y-3" aria-label="Loading messages">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full skeleton shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-32" />
                    <div className="skeleton h-4 w-full max-w-md" />
                    <div className="skeleton h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : msgStatus === "error" && messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10" role="alert">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <h3 className="text-base font-bold text-[var(--color-txt)] mb-1">
                Unable to load messages
              </h3>
              <p className="text-sm text-[var(--color-txt-muted)] max-w-xs mb-4">
                Check your connection and try again. Nothing is lost — your
                recent conversations are cached on this device.
              </p>
              <button
                onClick={() => Store.retryMessages(Store.currentChannelId)}
                className="btn-primary flex items-center gap-2"
                aria-label="Retry loading messages"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
              <div className="w-16 h-16 rounded-full bg-[var(--color-pri-muted)] flex items-center justify-center mb-4">
                {isDM ? (
                  <MessageSquare
                    size={28}
                    className="text-[var(--color-pri)]"
                  />
                ) : (
                  <Hash size={28} className="text-[var(--color-pri)]" />
                )}
              </div>
              <h3 className="text-lg font-bold text-[var(--color-txt)] mb-1">
                {isDM
                  ? dmName || 'Direct Messages'
                  : `Welcome to #${channelName}`}
              </h3>
              <p className="text-sm text-[var(--color-txt-muted)] max-w-xs">
                {isDM
                  ? 'This is the beginning of your direct message history.'
                  : 'No messages yet. Be the first to say something!'}
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs text-[var(--color-txt-muted)]">
                <Edit3 size={14} />
                <span>Type a message below to get started</span>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.sessionId === Store.sessionId;
              const profile = msg.sessionId ? profiles[msg.sessionId] : null;
              const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
              const showAvatar = shouldShowAvatar(prevMsg, msg);
              const isSameAuthor = !showAvatar;
              const isEditing = editing === msg.id;
              const dateSep = shouldShowDateSeparator(prevMsg, msg);
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={isOwn}
                  isSameAuthor={isSameAuthor}
                  showAvatar={showAvatar}
                  profile={profile}
                  dateSep={dateSep}
                  isEditing={isEditing}
                  displayName={displayName}
                  messages={messages}
                  editing={editing}
                  editText={editText}
                  toggleReaction={toggleReaction}
                  startEdit={startEdit}
                  saveEdit={saveEdit}
                  togglePin={(msgId: string) => Store.togglePin(msgId)}
                  setReplyTo={setReplyTo}
                  setThreadMessage={setThreadMessage}
                  setLightboxSrc={setLightboxSrc}
                  setEditing={setEditing}
                  setEditText={setEditText}
                  confirmDelete={(msgId: string) =>
                    setShowDeleteConfirm(msgId)
                  }
                />
              );
            })
          )}

          {/* Typing indicator */}
          {typingUsers.length > 0 && typingUsers[0]?.name && (
            <div className="flex items-center gap-2 mt-2 mb-1 px-1 text-xs text-[var(--color-txt-muted)] italic">
              <div className="w-9 shrink-0" />
              <div className="flex items-center gap-0.5">
                <span
                  className="w-1.5 h-1.5 bg-[var(--color-txt-muted)] rounded-full animate-bounce"
                  style={{ animationDelay: '0s', animationDuration: '1s' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-[var(--color-txt-muted)] rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s', animationDuration: '1s' }}
                />
                <span
                  className="w-1.5 h-1.5 bg-[var(--color-txt-muted)] rounded-full animate-bounce"
                  style={{ animationDelay: '0.4s', animationDuration: '1s' }}
                />
              </div>
              <span>
                {typingUsers[0].name} is typing
                {typingUsers.length > 1
                  ? ` and ${typingUsers.length - 1} more`
                  : ''}
                ...
              </span>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Upload progress */}
        {uploadProgress && (
          <div className="px-4 py-2 bg-[var(--color-bg-dark)] border-t border-[var(--color-border)] shrink-0">
            <div className="flex items-center justify-between text-xs text-[var(--color-txt-muted)] mb-1">
              <span className="truncate mr-3">
                Uploading {uploadProgress.fileName}
              </span>
              <span className="shrink-0">{uploadProgress.percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-bg-mid)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-pri)] transition-all duration-150"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        <MessageInput
          channelName={channelName}
          input={input}
          showEmoji={showEmoji}
          setShowEmoji={setShowEmoji}
          showMentions={showMentions}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          sendMsg={sendMsg}
          handleInput={handleInput}
          insertMention={insertMention}
          addEmoji={addEmoji}
          handleFileSelect={handleFileSelect}
          filteredMentions={filteredMentions}
        />

        {showSearch && (
          <Suspense fallback={null}>
            <SearchModal onClose={() => setShowSearch(false)} />
          </Suspense>
        )}

        {isMobile && drawerOpen && (
          <Suspense fallback={null}>
            <MobileChannelDrawer onClose={() => setDrawerOpen(false)} />
          </Suspense>
        )}

        {lightboxSrc && (
          <ImageLightbox
            src={lightboxSrc}
            onClose={() => setLightboxSrc(null)}
          />
        )}
      </div>

      {/* Desktop right sidebar — members + pinned updates (stitch 05/12) */}
      {!isDM && (
        <RightSidebar
          pins={pins}
          onlineUsers={onlineUsers}
          channelName={channelName}
        />
      )}

      {threadMessage && (
        <Suspense fallback={null}>
          <ThreadPanel
            parentMessage={threadMessage}
            onClose={() => setThreadMessage(null)}
            displayName={displayName}
          />
        </Suspense>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9998]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={
            showDeleteConfirm === 'file-too-large'
              ? 'File too large'
              : showDeleteConfirm === 'upload-failed'
                ? 'Upload failed'
                : 'Delete message confirmation'
          }
        >
          <div className="bg-[var(--color-bg-dark)] rounded-[20px] p-6 w-80 shadow-2xl border border-[var(--color-border)]">
            <h3 className="text-lg font-semibold text-[var(--color-txt)] mb-2">
              {showDeleteConfirm === 'file-too-large'
                ? 'File too large'
                : showDeleteConfirm === 'upload-failed'
                  ? 'Upload failed'
                  : 'Delete message'}
            </h3>
            <p className="text-sm text-[var(--color-txt-secondary)] mb-6">
              {showDeleteConfirm === 'file-too-large'
                ? 'File must be 20MB or smaller'
                : showDeleteConfirm === 'upload-failed'
                  ? 'Upload failed. Please try again.'
                  : 'Are you sure you want to delete this message?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-txt-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
                aria-label={
                  showDeleteConfirm === 'file-too-large' || showDeleteConfirm === 'upload-failed'
                    ? 'Dismiss'
                    : 'Cancel delete'
                }
              >
                {showDeleteConfirm === 'file-too-large' ||
                showDeleteConfirm === 'upload-failed'
                  ? 'OK'
                  : 'Cancel'}
              </button>
              {showDeleteConfirm !== 'file-too-large' &&
                showDeleteConfirm !== 'upload-failed' && (
                  <button
                    onClick={handleConfirmAction}
                    className="px-4 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                    aria-label="Confirm delete message"
                  >
                    Delete
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
