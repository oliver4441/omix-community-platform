"use client";

import { MessageSquare, Users, Home } from "@/components/ui/icons";

interface MobileNavProps {
  currentView: string;
  setView: (v: "chat" | "dms") => void;
}

export function MobileNav({ currentView, setView }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[var(--color-bg-dark)] border-t border-[var(--color-border)] flex items-center justify-around z-50">
      <button
        onClick={() => setView("chat")}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 ${
          currentView === "chat"
            ? "text-[var(--color-pri)]"
            : "text-[var(--color-txt-muted)]"
        }`}
      >
        <Home size={20} />
        <span className="text-[10px] font-medium">Home</span>
      </button>
      <button
        onClick={() => setView("dms")}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 ${
          currentView === "dms"
            ? "text-[var(--color-pri)]"
            : "text-[var(--color-txt-muted)]"
        }`}
      >
        <MessageSquare size={20} />
        <span className="text-[10px] font-medium">Messages</span>
      </button>
      <button className="flex flex-col items-center gap-0.5 px-4 py-1 text-[var(--color-txt-muted)]">
        <Users size={20} />
        <span className="text-[10px] font-medium">People</span>
      </button>
    </nav>
  );
}
