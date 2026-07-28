"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        if (!displayName.trim()) {
          setError("Please enter a display name");
          setSubmitting(false);
          return;
        }
        await signUp(email.trim(), password, displayName.trim());
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (
        e.code === "auth/user-not-found" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password");
      } else if (e.code === "auth/email-already-in-use") {
        setError("An account with this email already exists");
      } else if (e.code === "auth/weak-password") {
        setError("Password must be at least 6 characters");
      } else if (e.code === "auth/invalid-email") {
        setError("Please enter a valid email address");
      } else {
        setError(e.message || "Something went wrong");
      }
    }
    setSubmitting(false);
  };

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-deeper)] px-6"
        role="main"
        aria-label="Authentication"
      >
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="w-16 h-16 rounded-[20px] bg-[var(--color-pri)] flex items-center justify-center">
            <span className="text-2xl font-bold text-white">OS</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-txt)] tracking-tight">
            Omix Social
          </h1>
          <p className="text-sm text-[var(--color-txt-muted)]">
            Community-first platform
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm flex flex-col gap-4"
          aria-label={mode === "signin" ? "Sign in form" : "Create account form"}
        >
          {mode === "signup" && (
            <div>
              <label htmlFor="auth-display-name" className="sr-only">
                Display name
              </label>
              <input
                id="auth-display-name"
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                autoComplete="name"
                required
                aria-label="Display name"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="sr-only">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              autoComplete="email"
              required
              aria-label="Email address"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="sr-only">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              aria-label="Password"
            />
          </div>

          {error && (
            <p
              className="text-sm text-[var(--color-dnd)] bg-[var(--color-bg-dark)] rounded-[20px] px-4 py-2.5 border border-[var(--color-border)]"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full h-11 disabled:opacity-50"
            aria-busy={submitting}
            aria-label={submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
                Please wait…
              </span>
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-6 text-sm text-[var(--color-txt-muted)]">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="text-[var(--color-pri)] hover:text-[var(--color-pri-hover)] transition-colors font-medium"
            aria-label={mode === "signin" ? "Switch to create account" : "Switch to sign in"}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>

        {/* Footer */}
        <p className="mt-auto pt-8 pb-6 text-xs text-[var(--color-txt-muted)]">
          Designed by Omix Systems
        </p>
      </div>
    </ErrorBoundary>
  );
}
