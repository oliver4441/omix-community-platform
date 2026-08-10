"use client";

import { useEffect, useState } from "react";
import { api, type BoardPost } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Mso } from "@/components/ui/icons";
import { Markdown } from "@/components/Markdown";

const DEFAULT_CATEGORIES = [
  "All Discussions",
  "#Announcements",
  "#RFCs",
  "#Bugs",
];

export function BoardroomFeed(props: {
  isMobile: boolean;
  /** Pre-filled draft from another view (e.g. "Discuss" on a feed post). */
  initialDraft?: { title: string; body?: string; category?: string } | null;
}) {
  // isMobile is part of the shared view prop contract; layout is responsive on its own.
  void props.isMobile;

  const { user } = useAuth();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [category, setCategory] = useState("All Discussions");
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  // A feed post asked us to start a discussion — open the composer pre-filled.
  // (BoardroomFeed remounts per visit, so initializing from the prop here is safe.)
  const [draft, setDraft] = useState({
    category: props.initialDraft?.category || "#RFCs",
    title: props.initialDraft?.title || "",
    body: props.initialDraft?.body || "",
  });
  const [showComposer, setShowComposer] = useState(Boolean(props.initialDraft?.title));

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const data = await api.listBoardPosts();
        if (disposed) return;
        setPosts(data);
        setAvailable(true);
      } catch {
        if (!disposed) setAvailable(false);
      } finally {
        if (!disposed) setLoaded(true);
      }
    };
    load();

    const loadMyVotes = async () => {
      try {
        const { votes } = await api.getMyBoardVotes();
        if (disposed) return;
        const map: Record<string, boolean> = {};
        Object.keys(votes).forEach((id) => {
          map[id] = true;
        });
        setMyVotes(map);
      } catch {
        /* ignore */
      }
    };
    loadMyVotes();

    // Poll for new posts / vote-count changes (no realtime channel on D1).
    const timer = setInterval(load, 15000);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [user?.uid]);

  const filtered =
    category === "All Discussions"
      ? posts
      : posts.filter((p) => `#${p.category}` === category);

  const vote = async (post: BoardPost) => {
    const voted = myVotes[post.id];
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, voteCount: p.voteCount + (voted ? -1 : 1) } : p
      )
    );
    setMyVotes((prev) => ({ ...prev, [post.id]: !voted }));
    try {
      if (voted) await api.unvoteBoardPost(post.id);
      else await api.voteBoardPost(post.id);
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, voteCount: p.voteCount + (voted ? 1 : -1) } : p
        )
      );
      setMyVotes((prev) => ({ ...prev, [post.id]: voted }));
    }
  };

  /** Remove my vote (down arrow) — no-op unless I've already upvoted. */
  const unvote = async (post: BoardPost) => {
    if (!myVotes[post.id]) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, voteCount: p.voteCount - 1 } : p))
    );
    setMyVotes((prev) => ({ ...prev, [post.id]: false }));
    try {
      await api.unvoteBoardPost(post.id);
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, voteCount: p.voteCount + 1 } : p))
      );
      setMyVotes((prev) => ({ ...prev, [post.id]: true }));
    }
  };

  const submit = async () => {
    if (!draft.title.trim()) return;
    try {
      await api.createBoardPost({
        category: draft.category.replace(/^#/, "") || "General",
        title: draft.title.trim(),
        body: draft.body.trim(),
        authorName: user?.displayName || "Anonymous",
        authorColor: "#a078ff",
      });
      setDraft({ category: "#RFCs", title: "", body: "" });
      setShowComposer(false);
    } catch {
      /* ignore */
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto no-scrollbar">
      {/* Top app bar */}
      <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">
            Omix Community
          </h1>
        </div>
        <button
          className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all"
          aria-label="More options"
        >
          <Mso name="more_vert" />
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 gap-4 flex flex-col">
        <div className="hidden lg:flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Boardroom
          </h2>
        </div>

        {!available ? (
          <div className="glass-panel rounded-lg p-8 flex flex-col items-center gap-3 text-center">
            <Mso name="forum" size={40} className="text-on-surface-variant" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              Boardroom posts aren&apos;t available yet. Deploy the omix-gateway
              worker to enable them.
            </p>
          </div>
        ) : !loaded ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x">
              {DEFAULT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`snap-start flex-none px-4 py-1.5 rounded-full font-label-caps text-label-caps border whitespace-nowrap transition-colors ${
                    category === c
                      ? "bg-primary-container text-on-primary-container border-primary"
                      : "bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Posts */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Mso name="inbox" size={40} className="text-on-surface-variant" />
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  No posts in {category}. Start one with the + button.
                </p>
              </div>
            ) : (
              filtered.map((post) => {
                const myVote = myVotes[post.id];
                return (
                  <article
                    key={post.id}
                    className="relative overflow-hidden rounded-lg flex gap-3 p-4 bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant transition-colors"
                  >
                    {/* Vote column (desktop) */}
                    <div className="hidden sm:flex flex-col items-center gap-1 pt-1 shrink-0">
                      <button
                        onClick={() => vote(post)}
                        className={`w-8 h-8 rounded-full hover:bg-surface-container-high transition-colors ${
                          myVote ? "text-primary" : "text-on-surface-variant hover:text-primary"
                        }`}
                        aria-label={myVote ? "Remove upvote" : "Upvote"}
                      >
                        <Mso name="keyboard_arrow_up" size={20} fill={myVote} />
                      </button>
                      <span className="font-code-md text-code-md font-bold text-on-surface">
                        {post.voteCount}
                      </span>
                      <button
                        onClick={() => unvote(post)}
                        disabled={!myVote}
                        className={`w-8 h-8 rounded-full hover:bg-surface-container-high transition-colors ${
                          myVote ? "text-error" : "text-on-surface-variant hover:text-error"
                        } disabled:opacity-40 disabled:hover:bg-transparent`}
                        aria-label="Remove my vote"
                      >
                        <Mso name="keyboard_arrow_down" size={20} fill={myVote} />
                      </button>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-code-md text-code-md text-primary bg-primary/10 px-2 py-0.5 rounded">
                          #{post.category}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-code-md shrink-0"
                            style={{
                              background: post.authorColor || "#2d3449",
                            }}
                          >
                            {initials(post.authorName)}
                          </span>
                          @{post.authorName} ·{" "}
                          {new Date(post.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <h3 className="font-body-md text-body-md font-bold text-on-surface">
                        {post.title}
                      </h3>
                      {post.body && (
                        <div className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3">
                          <Markdown>{post.body}</Markdown>
                        </div>
                      )}
                      {/* Mobile vote + comments */}
                      <div className="sm:hidden flex items-center gap-2 mt-2 pt-2 border-t border-outline-variant/20">
                        <div className="flex items-center gap-1 text-on-surface-variant bg-surface-container rounded-full px-2 py-1 border border-outline-variant/30">
                          <button onClick={() => vote(post)} className={myVote ? "text-primary" : ""}>
                            <Mso name="keyboard_arrow_up" size={16} />
                          </button>
                          <span className="font-code-md text-code-md text-xs font-bold text-on-surface">
                            {post.voteCount}
                          </span>
                          <button
                            onClick={() => unvote(post)}
                            disabled={!myVote}
                            className={myVote ? "text-error" : "opacity-40"}
                          >
                            <Mso name="keyboard_arrow_down" size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}
      </main>

      {/* FAB */}
      {available && (
        <button
          onClick={() => setShowComposer(true)}
          className="fixed bottom-24 lg:bottom-8 right-4 w-14 h-14 bg-primary text-on-primary rounded-full shadow-[0_4px_14px_0_rgba(208,188,255,0.39)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
          aria-label="New post"
        >
          <Mso name="add" size={28} />
        </button>
      )}

      {/* Composer */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 p-0 lg:p-4">
          <div className="w-full lg:max-w-lg bg-surface-container rounded-t-xl lg:rounded-lg border border-outline-variant p-4 flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                New Boardroom Post
              </h3>
              <button
                onClick={() => setShowComposer(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <Mso name="close" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {["#Announcements", "#RFCs", "#Bugs", "#General"].map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((d) => ({ ...d, category: c }))}
                  className={`px-3 py-1 rounded-full font-label-caps text-label-caps border whitespace-nowrap ${
                    draft.category === c
                      ? "bg-primary-container text-on-primary-container border-primary"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              className="input-field"
              placeholder="Title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <textarea
              className="input-field min-h-24 resize-none"
              placeholder="Details…"
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowComposer(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submit} disabled={!draft.title.trim()}>
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
