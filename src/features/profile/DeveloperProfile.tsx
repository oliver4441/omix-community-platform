"use client";

import { useEffect, useState } from "react";
import { Store } from "@/lib/store";
import { api, type UserStatus, type GitHubOverview } from "@/lib/api";
import type { UserStats } from "@/lib/types";
import { Mso } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";

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

const STATUS_OPTIONS: { key: UserStatus; label: string; icon: string; color: string }[] = [
  { key: "online", label: "Online", icon: "radio_button_checked", color: "var(--color-online)" },
  { key: "idle", label: "Idle", icon: "schedule", color: "var(--color-idle)" },
  { key: "dnd", label: "Do not disturb", icon: "do_not_disturb_on", color: "var(--color-dnd)" },
  { key: "offline", label: "Invisible", icon: "radio_button_unchecked", color: "var(--color-offline)" },
];

interface DevProfile {
  name: string;
  avatar: string;
  color: string;
  githubUsername?: string;
  bio?: string;
  title?: string;
  skills?: string[];
  status?: UserStatus;
  statusText?: string;
}

export function DeveloperProfile({
  isMobile,
  displayName,
  profileUserId,
  onBack,
}: {
  isMobile: boolean;
  displayName: string;
  /** When set, shows ANOTHER user's profile instead of your own. */
  profileUserId?: string | null;
  onBack?: () => void;
}) {
  // isMobile is part of the shared view prop contract; layout is responsive on its own.
  void isMobile;
  const { user, signInWithGithub } = useAuth();
  const isOwn = !profileUserId || profileUserId === user?.uid;
  const targetId = (isOwn ? user?.uid : profileUserId) || null;
  const [profile, setProfile] = useState<DevProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [draftSkill, setDraftSkill] = useState("");
  const [status, setStatus] = useState<UserStatus>("online");
  const [statusText, setStatusText] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [statusSaved, setStatusSaved] = useState(false);
  const [github, setGithub] = useState<GitHubOverview | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubRefreshing, setGithubRefreshing] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    let active = true;
    const resetView = () => {
      setProfile(null);
      setGithub(null);
    };
    resetView();
    api.getProfile(targetId).then((p) => {
      if (!active || !p) return;
      setProfile(p);
      setSkills(p.skills || []);
      setStatus(p.status || "online");
      setStatusText(p.statusText || "");
      setStatusDraft(p.statusText || "");
    });
    Store.getStats(targetId).then((s) => active && setStats(s));
    const unsubStats = isOwn
      ? Store.subscribeStats((s) => active && setStats(s))
      : () => {};

    const loadGithub = () => {
      setGithubLoading(true);
      const p = isOwn
        ? api.getGithubRepos()
        : api.getProfileGithub(targetId);
      p.then((g) => active && setGithub(g))
        .catch(() => active && setGithub({ connected: false }))
        .finally(() => active && setGithubLoading(false));
    };
    loadGithub();

    return () => {
      active = false;
      unsubStats();
    };
  }, [targetId, isOwn]);

  const refreshGithub = async () => {
    setGithubRefreshing(true);
    try {
      const g = isOwn && targetId
        ? await api.getGithubRepos()
        : targetId
          ? await api.getProfileGithub(targetId)
          : { connected: false };
      setGithub(g);
    } catch {
      /* keep the last known state */
    } finally {
      setGithubRefreshing(false);
    }
  };

  const githubConnected = Boolean(github?.connected);
  const repos = github?.repos || [];
  const featuredRepos = [...repos]
    .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (!s || skills.includes(s)) return;
    const next = [...skills, s].slice(0, 12);
    setSkills(next);
    api.saveProfile({ skills: next }).catch(() => {});
    setDraftSkill("");
  };

  const removeSkill = (skill: string) => {
    const next = skills.filter((s) => s !== skill);
    setSkills(next);
    api.saveProfile({ skills: next }).catch(() => {});
  };

  const saveStatus = async () => {
    const next = statusDraft.trim().slice(0, 64);
    setStatusText(next);
    setStatusDraft(next);
    try {
      await api.setStatus(status, next);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 1500);
    } catch {
      /* ignore transient failures */
    }
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
        {/* Back (viewing someone else's profile) */}
        {!isOwn && (
          <button
            onClick={() => onBack?.()}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-md font-body-sm text-body-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          >
            <Mso name="arrow_back" size={16} />
            Back
          </button>
        )}

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
              {profile?.title && (
                <span className="font-code-md text-code-md text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant/30">
                  {profile.title}
                </span>
              )}
            </div>
            {profile?.bio && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                {profile.bio}
              </p>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {stats?.messagesSent ?? 0} messages · Level {level} · joined{" "}
              {stats?.joinDate || "recently"}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background:
                    STATUS_OPTIONS.find((s) => s.key === status)?.color ||
                    "var(--color-online)",
                }}
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {STATUS_OPTIONS.find((s) => s.key === status)?.label || "Online"}
                {statusText ? ` · ${statusText}` : ""}
              </span>
            </div>
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

        {/* Status (editable only on your own profile) */}
        {isOwn && (
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="monitor_heart" size={18} className="text-secondary" />
            Status
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setStatus(opt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-caps text-label-caps border transition-colors ${
                    status === opt.key
                      ? "bg-primary-container/20 text-primary border-primary"
                      : "bg-surface-container text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary"
                  }`}
                  aria-pressed={status === opt.key}
                >
                  <Mso name={opt.icon} size={14} />
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="input-field !py-1.5 flex-1"
                placeholder="Custom status (e.g. 'shipping 2.0')"
                value={statusDraft}
                maxLength={64}
                onChange={(e) => setStatusDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveStatus();
                }}
              />
              <button className="btn-primary !px-4 !py-1.5 !text-[11px]" onClick={saveStatus}>
                <Mso name={statusSaved ? "check" : "save"} size={16} />
                {statusSaved ? "Saved" : "Set"}
              </button>
            </div>
          </div>
        </section>
        )}

        {/* GitHub Overview */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="code" size={18} className="text-secondary" />
            GitHub Overview
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Repositories", value: github?.user?.publicRepos ?? 0 },
              { label: "Followers", value: github?.user?.followers ?? 0 },
              { label: "Following", value: github?.user?.following ?? 0 },
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
          {githubConnected && github?.user ? (
            <div className="glass-panel rounded-lg p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high shrink-0">
                {github.user.avatarUrl ? (
                  <img src={github.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-code-md text-on-surface">
                    @
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body-md text-body-md text-on-surface font-medium truncate">
                  Connected as{" "}
                  <a
                    href={`https://github.com/${github.user.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    @{github.user.login}
                  </a>
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {repos.length} repositories synced from GitHub
                </p>
              </div>
              {isOwn && (
                <button
                  onClick={refreshGithub}
                  disabled={githubRefreshing}
                  className="btn-ghost !text-[11px] !px-4 !py-1.5 shrink-0 disabled:opacity-50"
                >
                  <Mso name="refresh" size={16} className={githubRefreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-lg p-5 flex items-center gap-4">
              <Mso name="link" size={24} className="text-on-surface-variant" />
              <div className="flex-1">
                <p className="font-body-md text-body-md text-on-surface font-medium">
                  {isOwn ? "Connect GitHub to sync your repositories" : "No GitHub account linked"}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {isOwn
                    ? "Link your account to show your repos, followers and activity."
                    : "This user hasn't connected their GitHub account yet."}
                </p>
              </div>
              {isOwn && (
                <button
                  onClick={() => void signInWithGithub()}
                  className="btn-ghost !text-[11px] !px-4 !py-1.5 shrink-0"
                >
                  <Mso name="code" size={16} />
                  Connect
                </button>
              )}
            </div>
          )}
        </section>

        {/* Featured Repositories */}
        <section className="flex flex-col gap-3">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
            <Mso name="folder_special" size={18} className="text-secondary" />
            Featured Repositories
          </h3>
          {githubLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-28 rounded-lg" />
              ))}
            </div>
          ) : !githubConnected || featuredRepos.length === 0 ? (
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-8 flex flex-col items-center gap-2 text-center">
              <Mso name="folder_open" size={32} className="text-on-surface-variant" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {githubConnected
                  ? "No repositories found on this GitHub account yet."
                  : "No repositories yet — connect GitHub to feature your work."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {featuredRepos.map((repo) => (
                  <a
                    key={repo.fullName}
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-surface-container transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Mso name="folder" size={16} className="text-on-surface-variant shrink-0" />
                      <span className="font-code-md text-code-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                        {repo.fullName}
                      </span>
                      {repo.private && (
                        <span className="shrink-0 font-label-caps text-label-caps text-[9px] text-on-surface-variant bg-surface-container-high border border-outline-variant/30 px-1.5 py-0.5 rounded-full">
                          Private
                        </span>
                      )}
                      {repo.fork && (
                        <span className="shrink-0 font-label-caps text-label-caps text-[9px] text-on-surface-variant bg-surface-container-high border border-outline-variant/30 px-1.5 py-0.5 rounded-full">
                          Fork
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-auto pt-1 flex-wrap">
                      {repo.language && (
                        <span className="flex items-center gap-1.5 font-code-md text-code-md text-xs text-on-surface-variant">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-code-md text-code-md text-xs text-on-surface-variant">
                        <Mso name="star" size={13} />
                        {repo.stars}
                      </span>
                      <span className="flex items-center gap-1 font-code-md text-code-md text-xs text-on-surface-variant">
                        <Mso name="fork" size={13} />
                        {repo.forks}
                      </span>
                      <span className="font-body-sm text-body-sm text-[10px] text-on-surface-variant ml-auto">
                        {new Date(repo.updatedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
              {repos.length > featuredRepos.length && github?.user && (
                <a
                  href={`https://github.com/${github.user.login}?tab=repositories`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center font-body-sm text-body-sm text-primary hover:underline underline-offset-4"
                >
                  View all {repos.length} repositories on GitHub
                </a>
              )}
            </>
          )}
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
                  {isOwn && (
                    <button
                      onClick={() => removeSkill(skill)}
                      className="hover:text-error transition-colors"
                      aria-label={`Remove ${skill}`}
                    >
                      <Mso name="close" size={14} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isOwn && (
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
            )}
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
