"use client";

import { Bell, Blocks, Home, MessageCircle, UserRound } from "lucide-react";
import type { AppView } from "@/lib/views";

const TABS: { view: AppView; label: string; icon: typeof Home }[] = [
  { view: "feed", label: "Home", icon: Home },
  { view: "boards", label: "Boards", icon: Blocks },
  { view: "chat", label: "Chat", icon: MessageCircle },
  { view: "dms", label: "Calls", icon: Bell },
  { view: "profile", label: "Profile", icon: UserRound },
];

export function MobileNav({ currentView, setView }: { currentView: AppView; setView: (v: AppView) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 lg:hidden border-t border-outline-variant bg-surface-container/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,.18)]" aria-label="Primary navigation">
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {TABS.map(({ view, label, icon: Icon }) => {
          const active = view === currentView;
          return (
            <button key={view} type="button" onClick={() => setView(view)} aria-current={active ? "page" : undefined} className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 active:scale-95 transition ${active ? "text-primary" : "text-on-surface-variant"}`}>
              {active && <span className="absolute top-1 h-1 w-6 rounded-full bg-primary" aria-hidden="true" />}
              <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.5 : 2} />
              <span className="truncate text-[11px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
