"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Snippet } from "@/lib/api";
import { Mso } from "@/components/ui/icons";
import { CodeBlock } from "@/components/Markdown";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { useAuth } from "@/hooks/useAuth";

const LANG_PRESETS = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "sql",
  "bash",
  "json",
  "css",
  "html",
];

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

function previewCode(code: string, maxLines = 6): string {
  const lines = code.replace(/\n$/, "").split("\n");
  if (lines.length <= maxLines) return code.replace(/\n$/, "");
  return lines.slice(0, maxLines).join("\n");
}

const emptyDraft = { title: "", description: "", language: "typescript", tags: "", code: "" };

export function SnippetsPage({ isMobile }: { isMobile: boolean }) {
  void isMobile;
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm().confirm;
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [language, setLanguage] = useState("all");
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);

  const load = async () => {
    try {
      const [data, votes] = await Promise.all([
        api.getSnippets(),
        api.getSnippetVotes().catch(() => ({ votes: {} as Record<string, boolean> })),
      ]);
      if (!mounted.current) return;
      setSnippets(data);
      setVoted(new Set(Object.keys(votes.votes).filter((id) => votes.votes[id])));
      setAvailable(true);
    } catch {
      if (mounted.current) setAvailable(false);
    } finally {
      if (mounted.current) setLoaded(true);
    }
  };

  useEffect(() => {
    mounted.current = true;
    setTimeout(() => void load(), 0);
    return () => {
      mounted.current = false;
    };
  }, []);

  const languages = Array.from(
    new Set([...LANG_PRESETS, ...snippets.map((s) => s.language)])
  ).filter(Boolean);

  const filtered =
    language === "all" ? snippets : snippets.filter((s) => s.language === language);

  const copyCode = async (s: Snippet) => {
    try {
      await navigator.clipboard.writeText(s.code);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId((c) => (c === s.id ? null : c)), 1500);
    } catch {
      toast("Couldn't copy code", "error");
    }
  };

  const toggleVote = async (s: Snippet) => {
    const wasVoted = voted.has(s.id);
    const next = new Set(voted);
    if (wasVoted) next.delete(s.id);
    else next.add(s.id);
    setVoted(next);
    setSnippets((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, voteCount: x.voteCount + (wasVoted ? -1 : 1) } : x))
    );
    try {
      await api.voteSnippet(s.id, !wasVoted);
    } catch {
      setVoted(voted);
      setSnippets((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, voteCount: x.voteCount + (wasVoted ? 1 : -1) } : x))
      );
      toast("Couldn't update vote", "error");
    }
  };

  const removeSnippet = async (s: Snippet) => {
    const ok = await confirm({
      title: "Delete snippet",
      message: `Delete "${s.title}"? This can't be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteSnippet(s.id);
      setSnippets((prev) => prev.filter((x) => x.id !== s.id));
      toast("Snippet deleted", "success");
    } catch {
      toast("Couldn't delete snippet", "error");
    }
  };

  const submit = async () => {
    if (!draft.title.trim() || !draft.code.trim()) {
      toast("Title and code are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await api.createSnippet({
        title: draft.title.trim(),
        description: draft.description.trim(),
        language: draft.language || "text",
        code: draft.code,
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
      });
      const fresh: Snippet = {
        id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        language: draft.language || "text",
        code: draft.code,
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        authorId: user?.uid || "",
        authorName: user?.displayName || "Anonymous",
        authorColor: "#a078ff",
        voteCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSnippets((prev) => [fresh, ...prev]);
      setComposerOpen(false);
      setDraft(emptyDraft);
      toast("Snippet published", "success");
    } catch {
      toast("Couldn't publish snippet", "error");
    } finally {
      setSubmitting(false);
    }
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
            Snippets
          </h1>
        </div>
        <button
          onClick={() => setComposerOpen(true)}
          className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all"
          aria-label="New snippet"
        >
          <Mso name="add" size={22} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 gap-4 flex flex-col">
        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <Mso name="data_object" size={24} className="text-primary" />
              Community Snippets
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Reusable code from the community — vote up the ones that save you time.
            </p>
          </div>
          <button onClick={() => setComposerOpen(true)} className="btn-primary !px-4 !py-2">
            <Mso name="add" size={18} />
            New snippet
          </button>
        </div>

        {!available ? (
          <div className="glass-panel rounded-lg p-8 flex flex-col items-center gap-3 text-center">
            <Mso name="wifi_off" size={40} className="text-on-surface-variant" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              The snippets library isn&apos;t available yet — deploy the omix-gateway
              worker and apply the snippets migration to enable it.
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
            {/* Language filter */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x">
              {["all", ...languages].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`snap-start flex-none flex items-center gap-1.5 px-4 py-1.5 rounded-full font-label-caps text-label-caps border whitespace-nowrap transition-colors ${
                    language === lang
                      ? "bg-primary-container text-on-primary-container border-primary"
                      : "bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
                  }`}
                >
                  <Mso name={lang === "all" ? "filter_alt" : "code"} size={16} />
                  {lang === "all" ? "All" : lang}
                </button>
              ))}
            </div>

            {/* Snippets */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Mso name="data_object" size={40} className="text-on-surface-variant" />
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  No snippets here yet — be the first to share one.
                </p>
              </div>
            ) : (
              filtered.map((s) => {
                const isExpanded = expanded === s.id;
                const shown = isExpanded ? s.code : previewCode(s.code);
                const showTruncation = s.code.replace(/\n$/, "").split("\n").length > 6;
                const isMine = s.authorId === user?.uid;
                return (
                  <article
                    key={s.id}
                    className="rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant transition-colors overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 p-4 pb-3">
                      <button
                        onClick={() => void toggleVote(s)}
                        aria-pressed={voted.has(s.id)}
                        className={`flex flex-col items-center gap-0.5 w-10 shrink-0 py-1.5 rounded-md border transition-colors ${
                          voted.has(s.id)
                            ? "bg-primary-container text-primary border-primary"
                            : "bg-surface-container text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary"
                        }`}
                      >
                        <Mso name="thumb_up" size={16} fill={voted.has(s.id)} />
                        <span className="font-code-md text-code-md text-xs">{s.voteCount}</span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-body-md text-body-md font-bold text-on-surface">
                            {s.title}
                          </h3>
                          <span className="font-code-md text-code-md text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {s.language}
                          </span>
                        </div>
                        {s.description && (
                          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                            {s.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-code-md shrink-0"
                            style={{ background: s.authorColor || "#a078ff" }}
                          >
                            <span className="text-white">{s.authorName.charAt(0).toUpperCase()}</span>
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {s.authorName} · {timeAgo(s.createdAt)}
                          </span>
                          {s.tags.map((t) => (
                            <span
                              key={t}
                              className="font-code-md text-code-md text-[10px] text-on-surface-variant bg-surface-container-high border border-outline-variant/30 px-1.5 py-0.5 rounded-full"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void copyCode(s)}
                            className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                            aria-label="Copy code"
                          >
                            {copiedId === s.id ? (
                              <Mso name="check" size={16} className="text-secondary" />
                            ) : (
                              <Mso name="content_copy" size={16} />
                            )}
                          </button>
                          {isMine && (
                            <button
                              onClick={() => void removeSnippet(s)}
                              className="p-1.5 rounded text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
                              aria-label="Delete snippet"
                            >
                              <Mso name="delete" size={16} />
                            </button>
                          )}
                          {showTruncation && (
                            <button
                              onClick={() => setExpanded(isExpanded ? null : s.id)}
                              className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                              aria-label={isExpanded ? "Collapse code" : "Expand code"}
                            >
                              <Mso name={isExpanded ? "expand_less" : "expand_more"} size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Code */}
                    <div className="px-4 pb-4">
                      <CodeBlock className={`language-${s.language}`} code={shown} />
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}
      </main>

      {/* Composer modal */}
      {composerOpen && (
        <div
          className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-end lg:items-center justify-center z-[9998]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setComposerOpen(false);
          }}
        >
          <div
            className="bg-surface-container-low w-full lg:w-[600px] max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-2xl lg:rounded-2xl border border-outline-variant shadow-2xl p-5 flex flex-col gap-4"
            style={{ animation: "scaleIn 0.15s ease" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                New snippet
              </h3>
              <button
                onClick={() => setComposerOpen(false)}
                disabled={submitting}
                className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <Mso name="close" size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant">
                Title
              </label>
              <input
                className="input-field"
                placeholder="e.g. Ably presence heartbeat helper"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant">
                Description
              </label>
              <input
                className="input-field"
                placeholder="What does this snippet do?"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-2 flex-1 min-w-40">
                <label className="font-label-caps text-label-caps text-on-surface-variant">
                  Language
                </label>
                <select
                  className="input-field"
                  value={draft.language}
                  onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                >
                  {LANG_PRESETS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-40">
                <label className="font-label-caps text-label-caps text-on-surface-variant">
                  Tags (comma separated)
                </label>
                <input
                  className="input-field"
                  placeholder="auth, realtime, workers"
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant">
                Code
              </label>
              <textarea
                className="input-field !min-h-48 font-code-md text-code-md resize-y"
                placeholder={"export async function beat() {\n  await api.setPresence(...)\n}"}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                spellCheck={false}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setComposerOpen(false)}
                disabled={submitting}
                className="btn-ghost !px-4 !py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button onClick={() => void submit()} disabled={submitting} className="btn-primary !px-4 !py-2 disabled:opacity-50">
                {submitting ? "Publishing…" : "Publish snippet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
