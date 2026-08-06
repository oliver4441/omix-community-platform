# Cloudflare Workers API layer

The app is split into three tiers:

```
Frontend (Next.js static PWA)  ->  omix-api (Cloudflare Worker)  ->  Supabase / Ably
        src/                           workers/omix-api/                 (backend)
```

This keeps API secrets (Ably key, Supabase service-role key) **out of the client
bundle** and gives the app a simple CI/CD path: push to `main` → GitHub Actions
deploys the workers.

## Workers

| Worker       | Purpose                                                                  | Trigger          |
| ------------ | ------------------------------------------------------------------------ | ---------------- |
| `omix-api`   | Ably token issuance, admin password verify, push-notification queue, health | HTTP (`fetch`)   |
| `omix-cron`  | Sweeps stale typing rows + marks stale presence offline                  | Cron (`*/5 * * * *`) |

### omix-api routes

| Method | Route                     | Body                                    | Description                                  |
| ------ | ------------------------- | --------------------------------------- | -------------------------------------------- |
| GET    | `/health`                 | —                                       | Health check                                |
| GET/POST | `/ably/token`           | `{ "clientId" }` (POST) or `?clientId=` | Short-lived Ably token (1h, full capability) |
| POST   | `/admin/verify-password`  | `{ "password" }`                        | Secure admin check via service role          |
| POST   | `/notifications/queue`    | `{ userId, title, body?, data? }`       | Inserts into the `notifications` table       |

> **Securing `/ably/token`:** by default the endpoint is public (same exposure
> as the hardcoded key it replaces). Set `TOKEN_AUTH_SECRET` and send
> `Authorization: Bearer <secret>` to lock it down — but note the browser app
> can't hide a shared secret, so for a truly private endpoint mint the token
> from your own authenticated backend instead (or verify the caller's Supabase
> JWT in the worker).

## Local development

```bash
# Install wrangler (already in devDependencies)
npm install

# Local secrets (git-ignored) — copy the examples and fill in real values
cp workers/omix-api/.dev.vars.example workers/omix-api/.dev.vars
cp workers/omix-cron/.dev.vars.example workers/omix-cron/.dev.vars

# Run the API worker locally (http://localhost:8787)
npm run workers:dev

# Typecheck all workers
npm run workers:typecheck

# Bundling check (no upload)
npx wrangler deploy -c workers/omix-api/wrangler.toml --dry-run
npx wrangler deploy -c workers/omix-cron/wrangler.toml --dry-run
```

## One-time Cloudflare setup

1. Create a Cloudflare account, then a Workers API token with
   `Account > Workers Scripts > Edit` permission:
   https://dash.cloudflare.com/profile/api-tokens
2. Log in locally (opens a browser):
   ```bash
   npx wrangler login
   ```
3. Store the worker secrets in Cloudflare (never commit them):
   ```bash
   echo "your-ably-key"            | npx wrangler secret put ABLY_API_KEY              -c workers/omix-api/wrangler.toml
   echo "https://....supabase.co"  | npx wrangler secret put SUPABASE_URL              -c workers/omix-api/wrangler.toml
   echo "service-role-key"         | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c workers/omix-api/wrangler.toml
   echo "https://....supabase.co"  | npx wrangler secret put SUPABASE_URL              -c workers/omix-cron/wrangler.toml
   echo "service-role-key"         | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c workers/omix-cron/wrangler.toml
   # Optional: gate /ably/token behind a shared secret
   echo "your-token-secret"        | npx wrangler secret put TOKEN_AUTH_SECRET        -c workers/omix-api/wrangler.toml
   ```
4. Deploy:
   ```bash
   npm run workers:deploy
   ```

> **Note:** the service-role key bypasses Row Level Security — keep it
> server-side only. If your Supabase project doesn't have RLS enabled, call logs
> and the notifications queue are publicly readable; enable RLS before sharing
> the app broadly.

## CI/CD (GitHub Actions)

`.github/workflows/deploy-workers.yml` deploys both workers on push to `main`
(any changes under `workers/`). Add these repo secrets:

| Secret                         | Value                                        |
| ------------------------------ | -------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | Workers API token (Edit permission)          |
| `CLOUDFLARE_ACCOUNT_ID`        | Your Cloudflare account ID                   |
| `ABLY_API_KEY`                 | Ably API key (moved out of the client)       |
| `SUPABASE_URL`                 | `https://<project>.supabase.co`              |
| `SUPABASE_SERVICE_ROLE_KEY`    | Supabase service-role key                    |

To also deploy the frontend in the same workflow, append a job that runs
`npm run build` and uploads `dist/` (Firebase Hosting or Vercel) — the worker
deploy is intentionally a separate, focused job.

## Wiring the frontend

The frontend already has an API client (`src/lib/api.ts`) with graceful
fallbacks:

- **Ably tokens:** `src/lib/ably.ts` uses the worker's `/ably/token` endpoint
  automatically **when** `NEXT_PUBLIC_API_BASE_URL` is set at build time;
  otherwise it falls back to the hardcoded key.
- **Admin password:** `Store.verifyAdminPassword` calls
  `/admin/verify-password` first, falling back to the legacy client check.
- **Push notifications:** `Store.sendPushNotification` routes through
  `/notifications/queue`.

To go live with the worker:

```bash
# Build the static export with the API pointed at your worker
NEXT_PUBLIC_API_BASE_URL=https://omix-api.<your-subdomain>.workers.dev npm run build
```

Once the worker handles auth for everything, remove the fallback `ABLY_KEY`
from `src/lib/ably.ts` so the key no longer ships in the bundle at all.

**Transition notes:**

- `Store.verifyAdminPassword` keeps a client-side fallback (anon-key read of
  the `config` table) until the worker is deployed — remove that fallback once
  the worker is live so the admin password stops being readable by the anon key.
- The Ably fallback happens at **build time**: if
  `NEXT_PUBLIC_API_BASE_URL` is set but the worker is down at runtime, realtime
  goes down too (no automatic switch back to the hardcoded key).
- The CI workflow deploys first, then attaches secrets, and fails fast if any
  required repo secret is missing.
