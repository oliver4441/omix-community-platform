export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  /** File storage — KV on the free tier (no R2 activation / billing needed). */
  ASSETS: KVNamespace;

  // Secrets (wrangler secret put / CI)
  ABLY_API_KEY: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** Secret used to verify GitHub webhook signatures (X-Hub-Signature-256). */
  GITHUB_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Web Push VAPID private key (base64url PKCS8) — see scripts/generate-vapid.js. */
  VAPID_PRIVATE_KEY?: string;
  /** VAPID "sub" claim, e.g. mailto:admin@example.com */
  VAPID_SUBJECT?: string;

  // Vars
  CORS_ORIGIN?: string;
  /** Frontend origin used for email links + OAuth redirects, e.g. https://omix.app */
  APP_ORIGIN?: string;
  /** Optional shared secret gate for /ably/token. */
  TOKEN_AUTH_SECRET?: string;
}
