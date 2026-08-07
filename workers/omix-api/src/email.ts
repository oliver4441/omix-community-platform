import type { Env } from "./env";

/** Send a transactional email via Resend (REST — no SDK needed). */
export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn("[omix-api] RESEND_API_KEY not set — skipping email to", to);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "Omix Community <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  return res.ok;
}
