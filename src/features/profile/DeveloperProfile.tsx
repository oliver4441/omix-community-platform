"use client";

import { useEffect, useState } from "react";
import { Store } from "@/lib/store";
import type { UserStats } from "@/lib/types";
import { Mso } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";

const SKILLS_KEY = "omix_skills";

const SKILL_PRESETS = [
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Go",
  "Rust",
  "PostgreSQL",
  "Supabase",
  "WebRTC",
  "System Design",
];

export function DeveloperProfile({
  isMobile,
  displayName,
}: {
  isMobile: boolean;
  displayName: string;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ name: string; avatar: string; color: string } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [skills, setSkills] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(localStorage.getItem(SKILLS_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [draftSkill, setDraftSkill] = useState("");

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    let active = true;
    Store.getProfile(uid).then((p) => active && setProfile(p));
    Store.getStats(uid).then((s) => active && setStats(s));
    const unsubStats = Store.subscribeStats((s) => active && setStats(s));
    return () => {
      active = false;
      void unsubStats();
    };
  }, [user?.uid]);

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (!s || skills.includes(s)) return;
    const next = [...skills, s].slice(0, 12);
    setSkills(next);
    localStorage.setItem(SKILLS_KEY, JSON.stringify(next));
    setDraftSkill("");
  };

  const removeSkill = (skill: string) => {
    const next = skills.filter((s) => s !== skill);
    setSkills(next);
    localStorage.setItem(SKILLS_KEY, JSON.stringify(next));
  };

  const avatar = profile?.avatar || user?.photoURL;
  const color = profile?.color || "#a078ff";
  const name = profile?.name || displayName;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const level = stats?.level ?? Store.getLevel(stats?.xp ?? 0);

  const activity = [
    { icon: "send", text: "Developer active in the community", time: stats?.lastMessageDate || "—" },
    { icon: "battery_charging_full", text: `${stats?.xp ?? 0} XP earned`, time: `Level ${level}` },
    { icon: "local_fire_department", text: `${stats?.streakCount ?? 0} day message streak`, time: "—" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto no-scrollbar">
      {/* Top app bar (mobile) */}
      <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">
            Omix Community
          </h1>
        </div>
        <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all">
          <Mso name="more_vert" />
        </button>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Profile header */}
        <section className="flex flex-col lg:flex-row items-start gap-5">
          <div
            className="w-20 h-20 lg:w-28 lg:h-28 rounded-lg flex items-center justify-center font-display text-3xl lg:text-4xl shrink-0"
            style={{ background: color }}
          >
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {name}
              </h2>
              <span className="font-code-md text-code-md text-primary bg-primary/10 px-2 py-0.5 rounded">
                @{name.toLowerCase().replace(/\s+/g, "")}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {stats?.messagesSent ?? 0} messages · Level {level} · joined{" "}
              {stats?.joinDate || "recently"}
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button className="btn-primary !px-4 !py-1.5 !text-[11px]">
                <Mso name="person_add" size={16} />
                Follow
              </button>
              <button className="btn-ghost !px-4 !py-1.5 !text-[11px]">
                <Mso name="chat" size={16} />
                Message
              </button>
            </div>
          </div>
        </section>

        {/* GitHub Overview */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="code" size={18} className="text-secondary" />
            GitHub Overview
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Repositories", value: stats?.messagesSent ?? 0 },
              { label: "Followers", value: 0 },
              { label: "Following", value: 0 },
              { label: "Level", value: level },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-1"
              >
                <span className="font-code-md text-code-md text-2xl font-bold text-on-surface">
                  {item.value}
                </span>
                <span className="font-label-caps text-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="glass-panel rounded-lg p-5 flex items-center gap-4">
            <Mso name="link" size={24} className="text-on-surface-variant" />
            <div className="flex-1">
              <p className="font-body-md text-body-md text-on-surface font-medium">
                Connect GitHub to sync your repositories
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Link your account to show pinned repos, contribution activity and
                top languages.
              </p>
            </div>
            <button className="btn-ghost !text-[11px] !px-4 !py-1.5 shrink-0">
              <Mso name="code" size={16} />
              Connect
            </button>
          </div>
        </section>

        {/* Featured Repositories */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="folder_special" size={18} className="text-secondary" />
            Featured Repositories
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-8 flex flex-col items-center gap-2 text-center">
            <Mso name="folder_open" size={32} className="text-on-surface-variant" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No repositories yet — connect GitHub to feature your work.
            </p>
          </div>
        </section>

        {/* Skills & Expertise */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="psychology" size={18} className="text-secondary" />
            Skills &amp; Expertise
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {skills.length === 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Add a few skills to showcase your expertise.
                </p>
              )}
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-code-md text-code-md text-xs border border-primary/20"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="hover:text-error transition-colors"
                    aria-label={`Remove ${skill}`}
                  >
                    <Mso name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input-field !py-1.5 !w-40"
                placeholder="Add skill…"
                value={draftSkill}
                onChange={(e) => setDraftSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSkill(draftSkill);
                }}
              />
              <button className="btn-ghost !px-3 !py-1.5 !text-[11px]" onClick={() => addSkill(draftSkill)}>
                Add
              </button>
              {SKILL_PRESETS.filter((s) => !skills.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => addSkill(s)}
                  className="px-2 py-1 rounded-full bg-surface-container text-on-surface-variant font-code-md text-[11px] border border-outline-variant hover:border-primary hover:text-primary transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="flex flex-col gap-3 pb-8">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="history" size={18} className="text-secondary" />
            Recent Activity
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg divide-y divide-outline-variant/20">
            {activity.map((item) => (
              <div key={item.icon + item.text} className="flex items-center gap-3 p-4">
                <Mso name={item.icon} size={18} className="text-on-surface-variant shrink-0" />
                <p className="font-body-sm text-body-sm text-on-surface flex-1 min-w-0 truncate">
                  {item.text}
                </p>
                <span className="font-body-sm text-body-sm text-[11px] text-on-surface-variant shrink-0">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
