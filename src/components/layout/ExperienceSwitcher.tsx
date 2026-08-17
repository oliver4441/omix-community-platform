"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getActiveExperience, getExperiencePreferences, setActiveExperience } from "@/lib/experience";
import { Mso } from "@/components/ui/icons";

export function ExperienceSwitcher() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"community" | "developer">("community");
  const [canSwitch, setCanSwitch] = useState(false);

  useEffect(() => {
    if (!user) return;
    const sync = () => {
      const prefs = getExperiencePreferences(user.uid);
      setCanSwitch(prefs?.mode === "both");
      setMode(getActiveExperience(user.uid));
    };
    sync();
    window.addEventListener("omixExperienceChanged", sync);
    return () => window.removeEventListener("omixExperienceChanged", sync);
  }, [user]);

  if (!user || !canSwitch) return null;

  const nextMode = mode === "community" ? "developer" : "community";

  return (
    <button
      type="button"
      onClick={() => setActiveExperience(user.uid, nextMode)}
      className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center justify-between rounded-xl border border-outline-variant bg-surface-container p-3 text-left transition-colors hover:border-primary/50"
      aria-label={`Switch to ${nextMode} mode`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mso name={mode === "community" ? "public" : "code"} size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Current mode</span>
          <span className="block truncate text-sm font-semibold text-on-surface">
            {mode === "community" ? "Community" : "Developer"}
          </span>
        </span>
      </span>
      <Mso name="swap_horiz" size={19} className="shrink-0 text-primary" />
    </button>
  );
}
