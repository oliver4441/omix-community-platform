"use client";

import { Mso } from "@/components/ui/icons";
import type { AppView } from "@/lib/views";

const TABS: { view: AppView; label: string; icon: string }[] = [
  { view: "chat", label: "Chat", icon: "chat_bubble" },
  { view: "boards", label: "Boards", icon: "forum" },
  { view: "feed", label: "Updates", icon: "campaign" },
  { view: "dms", label: "Voice", icon: "videocam" },
  { view: "profile", label: "Profile", icon: "person" },
];

interface MobileNavProps {
  currentView: AppView;
  setView: (v: AppView) => void;
}

export function MobileNav({ currentView, setView }: MobileNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-around items-center h-16 pb-safe bg-surface-container-lowest/95 backdrop-blur-2xl border-t border-outline-variant/40 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      role="navigation"
      aria-label="Mobile Navigation"
    >
      {TABS.map((tab) => {
        const active = tab.view === currentView;
        return (
          <button
            key={tab.label}
            onClick={() => setView(tab.view)}
            className="flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
          >
            {/* Active Pill Container */}
            <div
              className={`px-4 py-1 rounded-full flex items-center justify-center transition-all ${
                active
                  ? "bg-primary-container/30 text-primary shadow-[0_0_12px_rgba(208,188,255,0.25)]"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Mso name={tab.icon} size={20} fill={active} />
            </div>
            <span
              className={`font-label-caps text-[11px] leading-none transition-colors ${
                active ? "text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
