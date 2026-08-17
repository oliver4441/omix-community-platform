"use client";

import { Award, Sparkles } from "lucide-react";
import { getLevelProgress } from "@/lib/rewards";

export function RewardsProgress({ xp = 0 }: { xp?: number }) {
  const progress = getLevelProgress(xp);
  const percent = progress.required ? Math.min(100, (progress.earned / progress.required) * 100) : 100;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Award className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold">Level {progress.level}</p><p className="text-xs text-muted-foreground">{xp.toLocaleString()} XP</p></div>
        </div>
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>
      <p className="mt-2 text-xs text-muted-foreground">{Math.max(0, progress.next - xp).toLocaleString()} XP to Level {progress.level + 1}</p>
    </section>
  );
}
