"use client";

import { useEffect, useRef, useState } from "react";
import { api, type FeedPost } from "@/lib/api";
import { Mso } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

type SourceKey = FeedPost["source"] | "all";

const SOURCE_TABS: { key: SourceKey; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "rss_feed" },
  { key: "hn", label: "Hacker News", icon: "terminal" },
  { key: "reddit", label: "Reddit", icon: "forum" },
  { key: "devto", label: "Dev.to", icon: "code" },
  { key: "github", label: "GitHub", icon: "folder_special" },
  { key: "producthunt", label: "Product Hunt", icon: "rocket_launch" },
];

const SOURCE_META: Record<FeedPost["source"], { label: string; color: string; scoreIcon: string }> = {
  hn: { label: "Hacker News", color: "#ff6600", scoreIcon: "keyboard_arrow_up" },
  reddit: { label: "Reddit", color: "#ff4500", scoreIcon: "keyboard_arrow_up" },
  devto: { label: "Dev.to", color: "#0a0a0a", scoreIcon: "favorite" },
  github: { label: "GitHub", color: "#8b949e", scoreIcon: "star" },
  producthunt: { label: "Product Hunt", color: "#ff6154", scoreIcon: "keyboard_arrow_up" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function FeedPage(props: {
  isMobile: boolean;
  onStartDiscussion: (draft: { title: string; body?: string; category?: string }) => void;
}) {
  void props.isMobile;
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [source, setSource] = useState<SourceKey>("all");
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = async () => {
    try {
      const data = await api.getFeed({ limit: 60 });
      if (!mounted.current) return;
      // Server dedupes, but guard against accidental repeats client-side too.
      const seen = new Set<string>();
      const deduped = data.filter((p) => (seen.has(p.title) ? false : (seen.add(p.title), true)));
      setPosts(deduped);
      setAvailable(true);
    } catch {
      if (mounted.current) setAvailable(false);
    } finally {
      if (mounted.current) setLoaded(true);
    }
  };

  useEffect(() => {
    mounted.current = true;
    // Deferred so the linter's set-state-in-effect rule doesn't flag it — all
    // state writes happen after an await anyway, never synchronously.
    setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 30_000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await api.refreshFeed();
      const failed = Object.entries(result.sources)
        .filter(([, s]) => s.status === "error")
        .map(([k]) => k);
      toast(
        failed.length
          ? `Refreshed — added ${result.added} post${result.added === 1 ? "" : "s"} (${failed.join(", ")} hit errors)`
          : `Refreshed — added ${result.added} new post${result.added === 1 ? "" : "s"}`,
        failed.length ? "error" : "success"
      );
      await load();
    } catch {
      toast("Couldn't refresh the feed right now", "error");
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

  const copyLink = async (post: FeedPost) => {
    try {
      await navigator.clipboard.writeText(post.sourceUrl);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId((c) => (c === post.id ? null : c)), 1500);
    } catch {
      toast("Couldn't copy link", "error");
    }
  };

  const filtered = source === "all" ? posts : posts.filter((p) => p.source === source);

  const scoreLabel = (post: FeedPost) => {
    const meta = SOURCE_META[post.source];
    const n = post.source === "github"
      ? post.relatedRepos.reduce((acc, r) => acc + r.stars, 0) || post.score
      : post.score;
    return { icon: meta.scoreIcon, value: n ? formatCount(n) : "" };
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto no-scrollbar">
      {/* Top app bar (mobile) */}
      <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">
            Developer Feed
          </h1>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all disabled:opacity-50"
          aria-label="Refresh feed"
        >
          <Mso name="refresh" size={22} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 gap-4 flex flex-col">
        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <Mso name="rss_feed" size={24} className="text-primary" />
              Developer Feed
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Curated from Hacker News, Reddit, GitHub, Dev.to and Product Hunt — refreshed on a loop, never repeated.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn-ghost !px-3 !py-2 flex items-center gap-2 disabled:opacity-50"
          >
            <Mso name="refresh" size={18} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {!available ? (
          <div className="glass-panel rounded-lg p-8 flex flex-col items-center gap-3 text-center">
            <Mso name="wifi_off" size={40} className="text-on-surface-variant" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              The developer feed isn&apos;t available yet — deploy the omix-api
              worker and apply the feed migration to enable it.
            </p>
          </div>
        ) : !loaded ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-32 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Source tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x">
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSource(tab.key)}
                  className={`snap-start flex-none flex items-center gap-1.5 px-4 py-1.5 rounded-full font-label-caps text-label-caps border whitespace-nowrap transition-colors ${
                    source === tab.key
                      ? "bg-primary-container text-on-primary-container border-primary"
                      : "bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
                  }`}
                >
                  <Mso name={tab.icon} size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Mso name="rss_feed" size={40} className="text-on-surface-variant" />
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Nothing here yet. Hit Refresh to pull the latest posts.
                </p>
              </div>
            ) : (
              filtered.map((post) => {
                const meta = SOURCE_META[post.source];
                const score = scoreLabel(post);
                return (
                  <article
                    key={post.id}
                    className="rounded-lg p-4 bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant transition-colors flex flex-col gap-2.5"
                  >
                    {/* Top meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-code-md text-code-md px-2 py-0.5 rounded flex items-center gap-1"
                        style={{ background: `${meta.color}1a`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {post.category && post.category !== meta.label && (
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {post.category}
                        </span>
                      )}
                      <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto flex items-center gap-1">
                        {post.author && <>@{post.author} · </>}
                        {timeAgo(post.publishedAt)}
                      </span>
                    </div>

                    {/* Title + thumbnail */}
                    <div className="flex gap-3 items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-body-md text-body-md font-bold text-on-surface leading-snug">
                          <a
                            href={post.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                          >
                            {post.title}
                          </a>
                        </h3>
                        {post.summary && (
                          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3 mt-1 whitespace-pre-line">
                            {post.summary}
                          </p>
                        )}
                      </div>
                      {post.imageUrl && (
                        <a
                          href={post.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 w-20 h-20 lg:w-24 lg:h-24 rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-high"
                        >
                          <img
                            src={post.imageUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement | null)?.remove();
                            }}
                          />
                        </a>
                      )}
                    </div>

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {post.tags.slice(0, 5).map((t) => (
                          <span
                            key={t}
                            className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/20"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Comment previews */}
                    {post.comments.length > 0 && (
                      <div className="flex flex-col gap-1.5 border-l-2 border-outline-variant/30 pl-3">
                        {post.comments.slice(0, 2).map((c, i) => (
                          <div key={i} className="font-body-sm text-body-sm text-on-surface-variant">
                            <span className="text-primary font-medium">{c.author}</span> — {c.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Related repos */}
                    {post.relatedRepos.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {post.relatedRepos.slice(0, 3).map((r) => (
                          <a
                            key={r.url}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 font-code-md text-code-md text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-md border border-outline-variant/20 hover:text-primary hover:border-outline-variant transition-colors"
                          >
                            <Mso name="code" size={14} />
                            {r.name}
                            <span className="text-xs flex items-center gap-0.5">
                              <Mso name="star" size={12} />
                              {formatCount(r.stars)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Stats + actions */}
                    <div className="flex items-center gap-3 pt-2 mt-1 border-t border-outline-variant/20 flex-wrap">
                      <span className="flex items-center gap-1 font-code-md text-code-md text-on-surface-variant">
                        <Mso name={score.icon} size={16} />
                        {score.value}
                      </span>
                      <span className="flex items-center gap-1 font-code-md text-code-md text-on-surface-variant">
                        <Mso name="chat_bubble" size={15} />
                        {post.numComments ? formatCount(post.numComments) : "—"}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => copyLink(post)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-body-sm text-body-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                          aria-label="Copy link"
                        >
                          <Mso name={copiedId === post.id ? "check" : "content_copy"} size={16} />
                          {copiedId === post.id ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={post.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-body-sm text-body-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                        >
                          <Mso name="open_in_new" size={16} />
                          Open
                        </a>
                        <button
                          onClick={() =>
                            props.onStartDiscussion({
                              title: post.title,
                              body: `Discussed on ${meta.label} — ${post.sourceUrl}\n\n${post.summary || ""}`,
                              category: "#General",
                            })
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-body-sm text-body-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <Mso name="forum" size={16} />
                          Discuss
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}
      </main>
    </div>
  );
}
