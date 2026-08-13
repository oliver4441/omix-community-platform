"use client";

import { useEffect, useState } from "react";
import { Mso } from "@/components/ui/icons";
import { Store } from "@/lib/store";
import type { AppView } from "@/lib/views";

const TABS: { view: AppView; label: string; icon: string }[] = [
  { view: "chat", label: "Chats", icon: "chat_bubble" },
  { view: "boards", label: "Forums", icon: "dashboard_customize" },
  { view: "feed", label: "Explore", icon: "rss_feed" },
  { view: "dms", label: "DMs", icon: "call" },
  { view: "profile", label: "Profile", icon: "person" },
];

interface MobileNavProps {
  currentView: AppView;
  setView: (v: AppView) => void;
}

export function MobileNav({ currentView, setView }: MobileNavProps) {
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const compute = () => {
      setChatUnread(
        Object.values(Store.unreadCounts).reduce((sum, n) => sum + (n || 0), 0)
      );
    };
    compute();
    const offDms = Store.subscribeDMChannels(() => compute());
    return () => {
      offDms();
    };
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex justify-around items-center h-16 pb-safe bg-surface-container/90 backdrop-blur-xl border-t border-outline-variant shadow-lg rounded-t-xl">
      {TABS.map((tab) => {
        const active = tab.view === currentView;
        const badge = tab.view === "chat" ? chatUnread : 0;
        return (
          <button
            key={tab.label}
            onClick={() => setView(tab.view)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full active:scale-90 transition-transform ${
              active
                ? "text-primary font-bold"
                : "text-on-surface-variant hover:text-primary"
            }`}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
          >
            <Mso name={tab.icon} size={22} fill={active} />
            {badge > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-22px)] min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            <span className="font-label-caps text-label-caps mt-1">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
