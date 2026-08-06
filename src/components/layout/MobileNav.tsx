"use client";

import { Mso } from "@/components/ui/icons";
import type { AppView } from "@/lib/views";

const TABS: { view: AppView; label: string; icon: string }[] = [
  { view: "chat", label: "Chat", icon: "chat_bubble" },
  { view: "boards", label: "Boards", icon: "dashboard_customize" },
  { view: "boards", label: "Feed", icon: "rss_feed" },
  { view: "dms", label: "Voice", icon: "call" },
  { view: "profile", label: "Profile", icon: "person" },
];

interface MobileNavProps {
  currentView: AppView;
  setView: (v: AppView) => void;
}

export function MobileNav({ currentView, setView }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-around items-center h-16 pb-safe bg-surface-container/90 backdrop-blur-xl border-t border-outline-variant shadow-lg rounded-t-xl">
      {TABS.map((tab) => {
        const active = tab.view === currentView;
        return (
          <button
            key={tab.label}
            onClick={() => setView(tab.view)}
            className={`flex flex-col items-center justify-center flex-1 h-full active:scale-90 transition-transform ${
              active
                ? "text-primary font-bold"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Mso name={tab.icon} size={22} fill={active} />
            <span className="font-label-caps text-label-caps mt-1">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
