export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  /** File storage — KV on the free tier (no R2 activation / billing needed). */
  ASSETS: KVNamespace;

  // Secrets (wrangler secret put / CI)
  ABLY_API_KEY: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  // Vars
  CORS_ORIGIN?: string;
  APP_ORIGIN?: string;
  /** Firebase Web API key. This is a client-side Firebase identifier, not a secret. */
  FIREBASE_WEB_API_KEY?: string;
  /** Optional shared secret gate for /ably/token. */
  TOKEN_AUTH_SECRET?: string;
}
