"use client";

import { useState } from "react";
import { Github, Mso } from "@/components/ui/icons";

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
  onGithub: () => void;
}

export function LandingPageV2({ onGetStarted, onSignIn, onGithub }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubError, setGithubError] = useState("");

  const handleGithub = async () => {
    setGithubBusy(true);
    setGithubError("");
    try { await onGithub(); }
    catch (err: unknown) {
      setGithubError((err as { message?: string }).message || "GitHub sign-in is unavailable.");
      setGithubBusy(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-background text-on-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant/40 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2 font-headline-sm font-bold text-primary" aria-label="Omix home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-on-primary shadow-[0_0_24px_rgba(208,188,255,.25)]">O</span>
            <span>Omix</span>
          </button>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
            <a href="#platform" className="text-sm text-on-surface-variant hover:text-on-surface">Platform</a>
            <a href="#developers" className="text-sm text-on-surface-variant hover:text-on-surface">Developers</a>
            <a href="#community" className="text-sm text-on-surface-variant hover:text-on-surface">Community</a>
            <a href="mailto:support@omix.dev" className="text-sm text-on-surface-variant hover:text-on-surface">Support</a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button onClick={onSignIn} className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high">Sign in</button>
            <button onClick={onGetStarted} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-fixed">Get started</button>
          </div>

          <button onClick={() => setMenuOpen(v => !v)} className="grid h-10 w-10 place-items-center rounded-lg border border-outline-variant text-on-surface md:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>
            <Mso name={menuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-outline-variant/40 bg-surface-container/95 px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              <a onClick={closeMenu} href="#platform" className="rounded-lg px-3 py-3 text-sm hover:bg-surface-container-high">Platform</a>
              <a onClick={closeMenu} href="#developers" className="rounded-lg px-3 py-3 text-sm hover:bg-surface-container-high">Developers</a>
              <a onClick={closeMenu} href="#community" className="rounded-lg px-3 py-3 text-sm hover:bg-surface-container-high">Community</a>
              <a href="mailto:support@omix.dev" className="rounded-lg px-3 py-3 text-sm hover:bg-surface-container-high">Support</a>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-outline-variant/30 pt-3">
                <button onClick={() => { closeMenu(); onSignIn(); }} className="rounded-lg border border-outline-variant px-4 py-3 text-sm font-semibold">Sign in</button>
                <button onClick={() => { closeMenu(); onGetStarted(); }} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-on-primary">Get started</button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section id="platform" className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-20">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-secondary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" /> Community platform for people who build
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-on-surface sm:text-5xl lg:text-6xl">
              One place to <span className="text-primary">build, talk,</span> and belong.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-on-surface-variant sm:text-lg">
              Omix brings developer collaboration, communities, forums, direct conversations and discovery into one adaptable experience.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={onGetStarted} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-on-primary shadow-[0_0_28px_rgba(208,188,255,.22)] hover:bg-primary-fixed">
                Create your account <Mso name="arrow_forward" size={19} />
              </button>
              <button onClick={handleGithub} disabled={githubBusy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-6 py-3.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-60">
                <Github size={19} /> {githubBusy ? "Redirecting…" : "Continue with GitHub"}
              </button>
            </div>
            {githubError && <p className="mt-4 rounded-lg border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error" role="alert">{githubError}</p>}
          </div>

          <div className="relative hidden min-h-[520px] lg:block" aria-hidden="true">
            <div className="hero-glow" />
            <div className="absolute inset-8 grid grid-cols-12 grid-rows-12 gap-3">
              <div className="glass-panel col-span-4 row-span-12 rounded-2xl p-4">
                <div className="mb-7 flex items-center gap-2 font-semibold text-primary"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-on-primary">O</span> Omix</div>
                {[['terminal','Developer'],['forum','Boardroom'],['chat','Messages'],['public','Community']].map(([icon,label], i) => <div key={label} className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${i === 0 ? 'bg-primary-container/20 text-primary' : 'text-on-surface-variant'}`}><Mso name={icon} size={19}/>{label}</div>)}
              </div>
              <div className="glass-panel col-span-8 row-span-7 rounded-2xl p-5">
                <div className="mb-5 flex items-center justify-between"><div><div className="text-sm font-semibold">Developer workspace</div><div className="text-xs text-on-surface-variant">Ship together</div></div><Mso name="more_horiz"/></div>
                <div className="space-y-3"><div className="h-4 w-4/5 rounded bg-surface-container-highest"/><div className="h-4 w-3/5 rounded bg-surface-container-highest"/><div className="h-20 rounded-xl border border-outline-variant bg-surface-container-low"/></div>
              </div>
              <div className="glass-panel col-span-8 row-span-5 rounded-2xl p-4"><div className="mb-3 text-xs font-semibold text-secondary">LIVE ACTIVITY</div><div className="space-y-3"><div className="h-3 w-full rounded bg-secondary/20"/><div className="h-3 w-4/5 rounded bg-primary/20"/><div className="h-3 w-2/3 rounded bg-tertiary/20"/></div></div>
            </div>
          </div>
        </section>

        <section id="developers" className="border-y border-outline-variant/30 bg-surface-container-low/40 px-4 py-16 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {[['code','Developer platform','Feeds, GitHub activity, technical communities and collaboration.'],['forum','Boardroom','Structured discussions that remain useful after the chat moves on.'],['chat','Private conversations','Direct messages and calls designed for one-to-one communication.']].map(([icon,title,text]) => <article key={title} className="rounded-2xl border border-outline-variant/50 bg-surface-container p-6"><div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary-container/20 text-primary"><Mso name={icon} size={23}/></div><h2 className="font-semibold text-on-surface">{title}</h2><p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p></article>)}
          </div>
        </section>

        <section id="community" className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-secondary">Developer-first. Community-friendly.</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">Choose how you experience Omix.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-on-surface-variant">Start with the experience that fits you. Your account can move between community and developer spaces whenever you want.</p>
          <button onClick={onGetStarted} className="mt-7 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-on-primary">Get started</button>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40 px-4 py-8 sm:px-6 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Omix Community</span><a href="mailto:support@omix.dev" className="hover:text-on-surface">Support</a></div></footer>
    </div>
  );
}
