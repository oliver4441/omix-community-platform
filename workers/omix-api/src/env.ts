export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  ASSETS: R2Bucket;

  // Secrets (wrangler secret put / CI)
  ABLY_API_KEY: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  // Vars
  CORS_ORIGIN?: string;
  /** Frontend origin used for email links + OAuth redirects, e.g. https://omix.app */
  APP_ORIGIN?: string;
  /** Optional shared secret gate for /ably/token. */
  TOKEN_AUTH_SECRET?: string;
}
