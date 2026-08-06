"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Mso } from "@/components/ui/icons";

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const ex = err as { message?: string };
      setError(ex.message || "Could not send reset link");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary-container/10 rounded-full blur-3xl pointer-events-none" />

      <main className="glass-panel rounded-xl w-full max-w-md p-8 flex flex-col shadow-2xl relative overflow-hidden z-10">
        <div className="text-center mb-6 relative z-10">
          <h1 className="font-headline-md text-headline-md text-primary mb-1">
            Omix Community
          </h1>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Reset Password
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
            {sent
              ? "Check your inbox — a reset link is on its way."
              : "Enter your email to receive a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center">
              <Mso name="mail" size={32} className="text-secondary" fill />
            </div>
            <p className="font-code-md text-code-md text-on-surface-variant text-center">
              We sent a reset link to{" "}
              <span className="text-primary">{email}</span>
            </p>
            <button
              onClick={onBack}
              className="w-full mt-2 bg-primary-container text-on-primary-container hover:bg-primary transition-colors duration-200 rounded py-3 font-label-caps text-label-caps flex items-center justify-center gap-2"
            >
              Back to Login
              <Mso name="arrow_back" size={18} />
            </button>
          </div>
        ) : (
          <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
            <div>
              <label className="sr-only" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mso
                  name="mail"
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="developer@omix.co"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded py-3 pl-10 pr-4 font-code-md text-code-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none glow-input transition-shadow duration-200"
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
              className="w-full bg-primary-container text-on-primary-container hover:bg-primary transition-colors duration-200 rounded py-3 font-label-caps text-label-caps flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send Reset Link"}
              {!submitting && (
                <Mso
                  name="arrow_forward"
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center relative z-10">
          <button
            onClick={onBack}
            className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <Mso name="arrow_back" size={16} />
            Back to Login
          </button>
        </div>
      </main>
    </div>
  );
}
