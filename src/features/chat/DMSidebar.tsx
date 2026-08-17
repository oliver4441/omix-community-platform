"use client";

/* eslint-disable react-hooks/immutability */
import { useState, useEffect } from "react";
import { Store } from "@/lib/store";
import type { DMChannel, User } from "@/lib/types";
import { MessageSquare, Plus, Search, X, History } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { RecentCallsModal } from "./RecentCallsModal";

export function DMSidebar({ isMobile, currentView, displayName, setView }: { isMobile: boolean; currentView: string; displayName: string; setView: (view: "chat" | "dms") => void }) {
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [dmChannelsLoaded, setDmChannelsLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showRecentCalls, setShowRecentCalls] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const unsubDMs = Store.subscribeDMChannels((dms) => {
      setDmChannels(dms as DMChannel[]);
      setDmChannelsLoaded(true);
    });
    const unsubPresence = Store.subscribePresence(setOnlineUsers);
    return () => {
      unsubDMs();
      unsubPresence();
      Store.cleanupDMChannels();
    };
  }, []);

  const selectDM = (dmChannel: DMChannel) => {
    Store.currentChannelId = dmChannel.id;
    Store.currentChannelType = "dm";
    const otherParticipant = dmChannel.participants.find((p) => p !== Store.sessionId);
    Store.currentDMChannelName = otherParticipant ? dmChannel.participantNames[otherParticipant] || "Unknown" : "Unknown";
    Store.markChannelRead(dmChannel.id);
    window.dispatchEvent(new CustomEvent("channelChanged", { detail: dmChannel.id }));
    if (isMobile) setView("chat");
  };

  const createNewDM = async (otherUserId: string) => {
    try {
      const dmId = await Store.createOrGetDMChannel(otherUserId);
      setShowNewDM(false);
      selectDM({ id: dmId } as DMChannel);
    } catch {
      toast("Failed to create DM", "error");
    }
  };

  const filteredDMs = dmChannels.filter((dm) => {
    const otherParticipant = dm.participants.find((p) => p !== Store.sessionId);
    if (!otherParticipant) return false;
    return (dm.participantNames[otherParticipant] || "Unknown").toLowerCase().includes(searchQuery.toLowerCase());
  });
  const availableUsers = onlineUsers.filter((u) => u.id !== Store.sessionId);
  const openPartnerFromCall = async (userId: string) => {
    try {
      const dmId = await Store.createOrGetDMChannel(userId);
      setShowRecentCalls(false);
      selectDM({ id: dmId } as DMChannel);
    } catch {
      toast("Could not open a conversation", "error");
    }
  };

  if (isMobile && currentView !== "dms") return null;

  return (
    <div className="w-[280px] bg-[var(--color-bg-dark)] h-full flex flex-col shrink-0 border-r border-[var(--color-border)]" data-name="dm-sidebar" role="navigation" aria-label="Direct messages">
      <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 gap-2">
        <MessageSquare size={18} className="text-[var(--color-txt-muted)] shrink-0" />
        <span className="font-semibold text-sm text-[var(--color-txt)] truncate">Direct Messages</span>
        <button onClick={() => setShowRecentCalls(true)} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors ml-auto" aria-label="Recent calls" title="Recent calls"><History size={16} className="text-[var(--color-txt-muted)]" /></button>
      </div>
      <div className="p-3 border-b border-[var(--color-border)] flex flex-col gap-2">
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-txt-muted)]" /><input type="text" placeholder="Search DMs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[var(--color-bg-mid)] text-[var(--color-txt)] rounded-[20px] pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-pri-muted)] border border-[var(--color-border)] placeholder-[var(--color-txt-muted)]" aria-label="Search direct messages" /></div>
        <button onClick={() => setShowNewDM(true)} className="btn-primary text-xs py-1.5 w-full" aria-label="Start a new direct message"><Plus size={14} />New Message</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!dmChannelsLoaded ? <div className="px-2 mt-4 space-y-1" aria-label="Loading direct messages">{[1,2,3,4].map((i) => <div key={i} className="flex items-center gap-3 px-3 py-2.5"><div className="w-10 h-10 rounded-full skeleton shrink-0" /><div className="flex-1 space-y-1.5"><div className="skeleton h-3 w-24" /><div className="skeleton h-2.5 w-32" /></div></div>)}</div> : filteredDMs.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-12 px-4"><MessageSquare size={28} className="text-[var(--color-txt-muted)] mb-3 opacity-40" /><p className="text-sm text-[var(--color-txt-muted)]">{searchQuery ? `No DMs matching “${searchQuery}”` : "No direct messages yet"}</p>{searchQuery ? <button onClick={() => setSearchQuery("")} className="mt-2 text-xs text-[var(--color-pri)] hover:underline">Clear search</button> : <button onClick={() => setShowNewDM(true)} className="mt-3 btn-primary text-xs py-1.5"><Plus size={14} />New Message</button>}</div> : <div role="list" aria-label="Direct message conversations">{filteredDMs.map((dm) => { const other = dm.participants.find((p) => p !== Store.sessionId); if (!other) return null; const name = dm.participantNames[other] || "Unknown"; const user = onlineUsers.find((u) => u.id === other); const unread = Store.unreadCounts[dm.id] || 0; return <div key={dm.id} onClick={() => selectDM(dm)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectDM(dm); } }} role="button" tabIndex={0} aria-label={`Direct message with ${name}${unread ? `, ${unread} unread` : ""}`} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] cursor-pointer mb-0.5 hover:bg-[var(--color-bg-hover)]"><div className="relative w-10 h-10 shrink-0"><div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-sm" style={{backgroundColor: user?.color || "#8B5CF6"}}>{name.charAt(0).toUpperCase()}</div>{user && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--color-online)] rounded-full border-2 border-[var(--color-bg-dark)]" />}</div><div className="flex-1 min-w-0"><div className="flex items-center justify-between"><span className="truncate font-medium text-sm text-[var(--color-txt)]">{name}</span>{dm.lastMessageAt && <span className="text-[10px] text-[var(--color-txt-muted)]">{new Date(dm.lastMessageAt as unknown as string | number).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span>}</div><div className="flex items-center gap-2"><span className="text-xs text-[var(--color-txt-muted)] truncate flex-1">{dm.lastMessageText ? `${dm.lastMessageAuthor === displayName ? "You: " : ""}${dm.lastMessageText}` : "No messages yet"}</span>{unread > 0 && <span className="bg-[var(--color-pri)] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{unread > 9 ? "9+" : unread}</span>}</div></div></div>})}</div>}
      </div>
      {showRecentCalls && <RecentCallsModal onClose={() => setShowRecentCalls(false)} onOpenPartner={openPartnerFromCall} />}
      {showNewDM && <div className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-50" onClick={(e) => {if(e.target === e.currentTarget) setShowNewDM(false)}} role="dialog" aria-modal="true" aria-label="New direct message"><div className="bg-[var(--color-bg-dark)] rounded-[20px] p-6 w-80 shadow-2xl border border-[var(--color-border)]"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-[var(--color-txt)]">New Message</h2><button onClick={() => setShowNewDM(false)} className="btn-icon" aria-label="Close"><X size={16}/></button></div><p className="text-sm text-[var(--color-txt-muted)] mb-4">Select a user to start a conversation</p><div className="max-h-60 overflow-y-auto" role="listbox">{availableUsers.length === 0 ? <p className="text-center text-[var(--color-txt-muted)] py-8 text-sm">No other users online</p> : availableUsers.map((user) => <button key={user.id} onClick={() => createNewDM(user.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-left hover:bg-[var(--color-bg-hover)]"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{backgroundColor:user.color}}>{user.name.charAt(0).toUpperCase()}</div><div className="font-medium text-sm text-[var(--color-txt)] truncate">{user.name}</div></button>)}</div></div></div>}
    </div>
  );
}
