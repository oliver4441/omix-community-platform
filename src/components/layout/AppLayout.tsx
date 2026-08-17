"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { WorkspaceRail } from "@/components/layout/WorkspaceRail";
import { ChannelSidebar } from "@/features/channels/ChannelSidebar";
import { ChatPane } from "@/features/chat/ChatPane";
import { CallPanel } from "@/features/chat/CallPanel";
import { DMSidebar } from "@/features/chat/DMSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { BoardroomFeed } from "@/features/boardroom/BoardroomFeed";
import { FeedPage } from "@/features/feed/FeedPage";
import { DeveloperProfile } from "@/features/profile/DeveloperProfile";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { WorkspaceDiscovery } from "@/features/onboarding/WorkspaceDiscovery";
import { CommunityHome } from "@/features/community/CommunityHome";
import { Store } from "@/lib/store";
import { getActiveExperience } from "@/lib/experience";
import type { Server } from "@/lib/types";
import type { AppView } from "@/lib/views";

export function AppLayout() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [view, setView] = useState<AppView>("feed");
  const [experience, setExperience] = useState<"community" | "developer">("developer");
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [discoveryDismissed, setDiscoveryDismissed] = useState(false);
  const [boardDraft, setBoardDraft] = useState<{ title: string; body?: string; category?: string } | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!user) return;
    const syncExperience = () => {
      const mode = getActiveExperience(user.uid);
      setExperience(mode);
      setView("feed");
    };
    syncExperience();
    window.addEventListener("omixExperienceChanged", syncExperience);
    return () => window.removeEventListener("omixExperienceChanged", syncExperience);
  }, [user]);

  useEffect(() => {
    const unsub = Store.subscribeServers((_, data) => {
      setServers(data as Server[]);
      setServersLoaded(true);
    });
    return () => void unsub();
  }, []);

  const showDiscovery = !!user && serversLoaded && servers.length === 0 && !discoveryDismissed;

  if (showDiscovery) {
    return (
      <WorkspaceDiscovery
        displayName={user?.displayName || "User"}
        onExplore={() => {
          setDiscoveryDismissed(true);
          setView("boards");
        }}
      />
    );
  }

  const isCommunity = experience === "community";

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden" role="application" aria-label="Omix Community workspace">
      <ErrorBoundary>
        <WorkspaceRail currentView={view} onNavigate={setView} displayName={user?.displayName || "User"} avatarUrl={user?.photoURL} />
      </ErrorBoundary>

      <div className="flex-1 flex overflow-hidden">
        {view === "dms" ? (
          <>
            <ErrorBoundary><DMSidebar isMobile={isMobile} currentView={view} displayName={user?.displayName || "User"} setView={setView} /></ErrorBoundary>
            <ErrorBoundary><ChatPane isMobile={isMobile} currentView={view} displayName={user?.displayName || "User"} /></ErrorBoundary>
          </>
        ) : view === "boards" ? (
          <ErrorBoundary><BoardroomFeed isMobile={isMobile} initialDraft={boardDraft} /></ErrorBoundary>
        ) : view === "feed" && isCommunity ? (
          <ErrorBoundary><CommunityHome onNavigate={setView} /></ErrorBoundary>
        ) : view === "feed" ? (
          <ErrorBoundary><FeedPage isMobile={isMobile} onStartDiscussion={(draft) => { setBoardDraft(draft); setView("boards"); }} /></ErrorBoundary>
        ) : view === "profile" ? (
          <ErrorBoundary><DeveloperProfile isMobile={isMobile} displayName={user?.displayName || "User"} /></ErrorBoundary>
        ) : view === "settings" ? (
          <ErrorBoundary><SettingsPage isMobile={isMobile} displayName={user?.displayName || "User"} /></ErrorBoundary>
        ) : (
          <>
            <ErrorBoundary><ChannelSidebar isMobile={isMobile} currentView={view} displayName={user?.displayName || "User"} /></ErrorBoundary>
            <ErrorBoundary><ChatPane isMobile={isMobile} currentView={view} displayName={user?.displayName || "User"} /></ErrorBoundary>
          </>
        )}
      </div>

      {view !== "boards" && boardDraft ? <BoardDraftClearer onClear={() => setBoardDraft(null)} /> : null}
      {isMobile && <MobileNav currentView={view} setView={setView} />}
      <CallPanel />
    </div>
  );
}

function BoardDraftClearer({ onClear }: { onClear: () => void }) {
  useEffect(() => {
    onClear();
  }, [onClear]);
  return null;
}
