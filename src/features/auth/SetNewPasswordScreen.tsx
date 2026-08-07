"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Mso } from "@/components/ui/icons";

export function SetNewPasswordScreen({
  token,
  onDone,
}: {
  token?: string | null;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { updatePassword } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("This recovery link is invalid. Request a new one.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(token, password);
      onDone();
    } catch (err: unknown) {
      const ex = err as { message?: string };
      setError(ex.message || "Could not update password");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary-container/10 rounded-full blur-3xl pointer-events-none" />

      <main className="glass-panel rounded-xl w-full max-w-md p-8 flex flex-col shadow-2xl relative overflow-hidden z-10">
        <div className="text-center mb-6 relative z-10">
          <h1 className="font-headline-md text-headline-md text-primary mb-1">
            Omix Community
          </h1>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Set a New Password
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
            Your recovery link is verified. Choose a new password for your
            account.
          </p>
        </div>

        <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="new-password"
              className="block font-body-sm text-body-sm text-on-surface mb-1"
            >
              New Password
            </label>
            <div className="relative">
              <Mso
                name="lock"
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                id="new-password"
                type={show ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-3 pl-10 pr-10 font-code-md text-code-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none glow-input transition-shadow duration-200"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label={show ? "Hide password" : "Show password"}
              >
                <Mso name={show ? "visibility_off" : "visibility"} size={20} />
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block font-body-sm text-body-sm text-on-surface mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Mso
                name="lock"
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                id="confirm-password"
                type={show ? "text" : "password"}
                placeholder="Re-enter your new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded py-3 pl-10 pr-4 font-code-md text-code-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none glow-input transition-shadow duration-200"
                required
                autoComplete="new-password"
              />
            </div>
          </div>
          {error && (
            <p
              className="text-sm text-[var(--color-dnd)] bg-surface-container rounded-lg px-4 py-2.5 border border-outline-variant/60"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-container text-on-primary-container hover:bg-primary transition-colors duration-200 rounded py-3 font-label-caps text-label-caps flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? "Updating…" : "Update Password"}
            <Mso name="arrow_forward" size={18} />
          </button>
        </form>
      </main>
    </div>
  );
}
