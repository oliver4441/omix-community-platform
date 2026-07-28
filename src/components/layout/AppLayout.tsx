"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ServerRail } from "@/features/servers/ServerRail";
import { ChannelSidebar } from "@/features/channels/ChannelSidebar";
import { ChatPane } from "@/features/chat/ChatPane";
import { DMSidebar } from "@/features/chat/DMSidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export function AppLayout() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [view, setView] = useState<"chat" | "dms">("chat");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      className="h-screen w-full flex bg-[var(--color-bg-deeper)] overflow-hidden"
      role="application"
      aria-label="Omix Social chat application"
    >
      <ErrorBoundary>
        <ServerRail
          isMobile={isMobile}
          currentView={view}
          onDMClick={() => setView("dms")}
        />
      </ErrorBoundary>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {view === "dms" ? (
          <ErrorBoundary>
            <DMSidebar
              isMobile={isMobile}
              currentView={view}
              displayName={user?.displayName || "User"}
              setView={setView}
            />
          </ErrorBoundary>
        ) : (
          <>
            <ErrorBoundary>
              <ChannelSidebar
                isMobile={isMobile}
                currentView={view}
                displayName={user?.displayName || "User"}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <ChatPane
                isMobile={isMobile}
                currentView={view}
                displayName={user?.displayName || "User"}
              />
            </ErrorBoundary>
          </>
        )}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && <MobileNav currentView={view} setView={setView} />}
    </div>
  );
}
