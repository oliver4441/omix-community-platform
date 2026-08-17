"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Github, Mso } from "@/components/ui/icons";

export function AuthScreen({ mode: initialMode = "signin", onForgotPassword }: { mode?: "signin" | "signup"; onForgotPassword?: () => void; onVerifyPending?: (email: string) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);
  const { signIn, signUp, signInWithGoogle, signInWithGithub } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else { if (!displayName.trim()) throw new Error("Please enter a display name"); await signUp(email.trim(), password, displayName.trim()); }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }; const code = e.code || ""; const msg = (e.message || "").toLowerCase();
      if (code === "auth/invalid-email") setError("Please enter a valid email address");
      else if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(code)) setError("Invalid email or password");
      else if (code === "auth/email-already-in-use") setError("An account with this email already exists");
      else if (code === "auth/weak-password") setError("Password must be at least 6 characters");
      else if (code === "auth/too-many-requests" || msg.includes("too many")) setError("Too many attempts. Please wait a moment and try again.");
      else setError(e.message || "Something went wrong");
    } finally { setSubmitting(false); }
  };

  const oauth = async (provider: "google" | "github") => {
    setError(""); setOauthBusy(provider);
    try { if (provider === "google") await signInWithGoogle(); else await signInWithGithub(); }
    catch (err: unknown) { const e = err as { message?: string }; setError(e.message || `${provider === "google" ? "Google" : "GitHub"} sign-in failed`); setOauthBusy(null); }
  };

  return <ErrorBoundary><div className="min-h-[100dvh] overflow-y-auto overflow-x-hidden flex flex-col bg-background text-on-background">
    <header className="sticky top-0 z-20 w-full backdrop-blur-md bg-background/85 border-b border-outline-variant/30 px-4 sm:px-6 py-4"><div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg overflow-hidden border border-outline-variant/40"><img src="/logo.jpg" alt="Omix" className="w-full h-full object-cover" /></div><span className="font-headline-sm text-headline-sm font-bold text-primary">Omix</span></div>
      <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} className="text-sm text-primary font-medium hover:underline">{mode === "signin" ? "Create account" : "Sign in"}</button>
    </div></header>
    <main className="flex-1 w-full flex items-start sm:items-center justify-center px-4 py-8 sm:py-12"><section className="w-full max-w-[460px] bg-surface-container/70 backdrop-blur-2xl border border-outline-variant/50 rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-6 sm:p-8 text-center border-b border-outline-variant/30"><h1 className="font-headline-md text-headline-md text-on-surface font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1><p className="mt-2 text-sm text-on-surface-variant">{mode === "signin" ? "Sign in to your Omix workspace." : "Join the Omix developer and community ecosystem."}</p></div>
      <div className="p-6 sm:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => oauth("google")} disabled={oauthBusy !== null || submitting} className="min-h-12 flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-bright border border-outline-variant rounded-xl px-4 font-medium disabled:opacity-60"><span className="font-bold text-base" aria-hidden="true">G</span>{oauthBusy === "google" ? "Connecting…" : "Google"}</button>
          <button onClick={() => oauth("github")} disabled={oauthBusy !== null || submitting} className="min-h-12 flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-bright border border-outline-variant rounded-xl px-4 font-medium disabled:opacity-60"><Github size={19} />{oauthBusy === "github" ? "Connecting…" : "GitHub"}</button>
        </div>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant"><div className="h-px flex-1 bg-outline-variant/50" /><span>OR EMAIL</span><div className="h-px flex-1 bg-outline-variant/50" /></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && <div><label htmlFor="auth-display-name" className="block text-sm font-medium mb-1.5">Display name</label><input id="auth-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 outline-none focus:border-primary" /></div>}
          <div><label htmlFor="auth-email" className="block text-sm font-medium mb-1.5">Email address</label><input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 outline-none focus:border-primary" /></div>
          <div><div className="flex items-center justify-between mb-1.5"><label htmlFor="auth-password" className="text-sm font-medium">Password</label>{mode === "signin" && onForgotPassword && <button type="button" onClick={onForgotPassword} className="text-xs text-primary hover:underline">Forgot password?</button>}</div><div className="relative"><input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 pr-12 outline-none focus:border-primary" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant" aria-label={showPassword ? "Hide password" : "Show password"}><Mso name={showPassword ? "visibility_off" : "visibility"} size={20} /></button></div></div>
          {error && <p className="rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-sm text-[var(--color-dnd)]" role="alert">{error}</p>}
          <button type="submit" disabled={submitting || oauthBusy !== null} className="w-full min-h-12 rounded-xl bg-primary text-on-primary font-semibold disabled:opacity-50">{submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}</button>
        </form>
      </div>
      <div className="border-t border-outline-variant/30 bg-surface-container-lowest/70 p-4 text-center text-sm text-on-surface-variant">{mode === "signin" ? "Don't have an account?" : "Already have an account?"} <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} className="text-primary font-medium hover:underline">{mode === "signin" ? "Sign up" : "Sign in"}</button></div>
    </section></main>
  </div></ErrorBoundary>;
}
