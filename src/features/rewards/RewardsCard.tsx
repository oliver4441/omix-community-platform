"use client";

import { Award, ChevronRight, Sparkles } from "lucide-react";
import { getLevelProgress } from "@/features/rewards/rewards";

export function RewardsCard({ xp = 0, badgeCount = 0 }: { xp?: number; badgeCount?: number }) {
  const progress = getLevelProgress(xp);
  return (
    <section className="surface-elevated p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Rewards</span></div>
          <h3 className="mt-1 text-lg font-semibold text-on-surface">Level {progress.level}</h3>
          <p className="text-sm text-on-surface-variant">{xp.toLocaleString()} XP · {badgeCount} badges</p>
        </div>
        <Award className="h-7 w-7 text-secondary" />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-on-surface-variant"><span>Next level</span><span>{progress.percent}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} /></div>
      </div>
      <button type="button" className="mt-4 flex w-full items-center justify-between rounded-xl bg-surface-container-high px-3 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-highest">
        View achievements <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}
