"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Mso } from "@/components/ui/icons";

export function VerifyEmailScreen({
  email,
  onChangeEmail,
  error: linkError,
}: {
  email: string;
  onChangeEmail: () => void;
  error?: string;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { resendVerification } = useAuth();

  const resend = async () => {
    setError("");
    try {
      await resendVerification(email);
      setSent(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Could not resend the link");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Atmospheric background effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary-container/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none translate-y-1/3" />

      <main className="w-full max-w-[480px] bg-surface-container-low/80 backdrop-blur-2xl border border-outline-variant/40 rounded-xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative z-10 flex flex-col items-center text-center">
        {/* Animated icon */}
        <div className="w-24 h-24 mb-6 rounded-full bg-surface-container-highest/50 flex items-center justify-center border border-outline-variant/50 relative group">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/30 transition-all duration-500" />
          <div className="absolute inset-2 border border-outline-variant/30 rounded-full border-dashed" />
          <Mso
            name="forward_to_inbox"
            size={40}
            fill
            className="text-primary relative z-10 drop-shadow-[0_0_12px_rgba(208,188,255,0.5)]"
          />
        </div>

        <h1 className="font-headline-md text-headline-md text-on-surface mb-2 tracking-tight">
          Check your inbox
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6 max-w-[320px]">
          We&apos;ve sent a secure verification link to authenticate your
          workspace access at
          <span className="inline-flex items-center gap-1 text-primary font-code-md text-code-md mt-3 px-2 py-[2px] bg-surface-container-highest rounded border border-outline-variant/50 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            {email}
          </span>
        </p>

        {sent && (
          <p className="mb-4 text-sm text-secondary" role="status">
            Link resent — check your inbox again.
          </p>
        )}
        {linkError && (
          <p className="mb-4 text-sm text-[var(--color-dnd)]" role="alert">
            {linkError}
          </p>
        )}
        {error && !linkError && (
          <p className="mb-4 text-sm text-[var(--color-dnd)]" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col w-full gap-4">
          <button
            onClick={resend}
            className="w-full h-12 bg-primary text-on-primary font-label-caps text-label-caps rounded flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors active:scale-[0.98] duration-150 shadow-[0_0_20px_rgba(208,188,255,0.1)] hover:shadow-[0_0_24px_rgba(208,188,255,0.2)]"
          >
            <Mso name="outgoing_mail" size={18} />
            RESEND VERIFICATION LINK
          </button>
          <button
            onClick={onChangeEmail}
            className="w-full h-12 bg-transparent border border-secondary text-secondary font-label-caps text-label-caps rounded flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors active:scale-[0.98] duration-150"
          >
            <Mso name="edit_square" size={18} />
            CHANGE EMAIL ADDRESS
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-outline-variant/30 w-full">
          <p className="font-body-sm text-body-sm text-outline flex items-center justify-center gap-1">
            <Mso name="info" size={16} />
            Don&apos;t see it? Check your spam folder.
          </p>
        </div>
      </main>
    </div>
  );
}
