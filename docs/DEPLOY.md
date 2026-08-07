# Omix Community — Deployment Guide

## Architecture

```
Frontend (Next.js static PWA)  ->  omix-api (Cloudflare Worker)  ->  Supabase / Ably
        src/                           workers/omix-api/                 (backend)
```

| Tier      | Tech                                            | Deploy target                       |
| --------- | ----------------------------------------------- | ----------------------------------- |
| Frontend  | Next.js 16 + React 19, static export to `dist/` | **Vercel** (or Firebase Hosting)    |
| API       | `omix-api` Cloudflare Worker (tokens, admin, notifications) | Cloudflare Workers      |
| Cron      | `omix-cron` Cloudflare Worker (cleanup every 5 min)        | Cloudflare Workers      |
| Data/auth | Supabase (Postgres + Auth, anon key in client)  | supabase.com                       |
| Realtime  | Ably (token issued by the worker)               | ably.com                            |

> **Stack note:** Firebase is legacy. Data/auth is **Supabase** (`src/lib/supabase.ts`),
> and the `firebase` npm package is only referenced as an image remote pattern in
> `next.config.ts`. Do not "fix" Firebase code — there is none in `src/`.

## Status

- ✅ `npm run build` — static export to `dist/` (TS typecheck runs during build)
- ✅ `npm run workers:typecheck` — workers compile clean
- ✅ CI workflows exist for both the frontend (Vercel) and the workers (Cloudflare)
- ⏳ Deployment only needs account auth + repo secrets (steps below)

## One-time setup

### 1. Cloudflare Workers (API layer)

1. Create a Cloudflare account and a Workers API token
   (`Account > Workers Scripts > Edit`): https://dash.cloudflare.com/profile/api-tokens
2. Log in locally:
   ```bash
   npx wrangler login
   ```
3. Store worker secrets in Cloudflare (never commit them):
   ```bash
   echo "your-ably-key"            | npx wrangler secret put ABLY_API_KEY              -c workers/omix-api/wrangler.toml
   echo "https://....supabase.co"  | npx wrangler secret put SUPABASE_URL              -c workers/omix-api/wrangler.toml
   echo "service-role-key"         | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c workers/omix-api/wrangler.toml
   echo "https://....supabase.co"  | npx wrangler secret put SUPABASE_URL              -c workers/omix-cron/wrangler.toml
   echo "service-role-key"         | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c workers/omix-cron/wrangler.toml
   ```
4. Deploy:
   ```bash
   npm run workers:deploy
   ```
5. Verify: `curl https://omix-api.<your-subdomain>.workers.dev/health`

### 2. Vercel (frontend)

1. Create the project in the Vercel dashboard (import the repo, framework preset
   **Next.js**, build `next build`, output `dist` — already set in `vercel.json`).
2. Disable Vercel's native Git deployments (or keep them; CI will deploy).
   `vercel.json` sets `"git": { "deploymentEnabled": false }` so only the
   GitHub Action deploys — remove that block if you prefer native integration.
3. Create a token: https://vercel.com/account/tokens (scope: full).
4. Get `orgId` / `projectId` from `.vercel/project.json` after linking locally:
   ```bash
   npx vercel link
   cat .vercel/project.json
   ```
5. Optional: add `NEXT_PUBLIC_API_BASE_URL` as a **build-time** env var
   (production) pointing at your deployed worker, e.g.
   `https://omix-api.<your-subdomain>.workers.dev`. If unset, the app falls
   back to the bundled Ably key (works but ships the key in the client).

### 3. GitHub repo secrets

| Secret                         | Used by         | Value                                            |
| ------------------------------ | --------------- | ------------------------------------------------ |
| `VERCEL_TOKEN`                 | frontend CI     | Vercel token                                     |
| `VERCEL_ORG_ID`                | frontend CI     | from `.vercel/project.json`                      |
| `VERCEL_PROJECT_ID`            | frontend CI     | from `.vercel/project.json`                      |
| `NEXT_PUBLIC_API_BASE_URL`     | frontend CI     | optional worker URL (see above)                  |
| `CLOUDFLARE_API_TOKEN`         | workers CI      | Workers API token (Edit permission)              |
| `CLOUDFLARE_ACCOUNT_ID`        | workers CI      | Cloudflare account ID                            |
| `ABLY_API_KEY`                 | workers CI      | Ably API key                                     |
| `SUPABASE_URL`                 | workers CI      | `https://<project>.supabase.co`                  |
| `SUPABASE_SERVICE_ROLE_KEY`    | workers CI      | Supabase service-role key                        |

Both workflows fail fast with a clear `::error::` message if a required secret
is missing, so you'll know exactly what to add.

## Deploy

### Automatic (CI/CD)

Push to `master` and GitHub Actions handles everything:

- `.github/workflows/deploy-frontend.yml` — builds and deploys the static PWA
  to Vercel production (`vercel pull` → `vercel build` → `vercel deploy --prebuilt --prod`).
- `.github/workflows/deploy-workers.yml` — typechecks and deploys both
  Cloudflare Workers, then attaches their secrets.

You can also run both on demand via the **Actions** tab (workflow_dispatch).

### Manual

```bash
# Frontend (Vercel)
npm run build
npx vercel deploy --prod --prebuilt   # after npx vercel pull

# Workers (Cloudflare)
npm run workers:typecheck
npm run workers:deploy
```

## Migrations (Supabase)

SQL migrations live in `supabase/migrations/` (idempotent `CREATE TABLE IF NOT
EXISTS` statements) and are applied via the Supabase SQL editor or
`supabase db push`.

**Project:** `https://frcmgkayluazwkokywux.supabase.co`

> ⚠️ **Important:** the `frcmgkayluazwkokywux` project belongs to a different
> Supabase account than the one currently logged in on this machine — run the
> steps below from a machine/account that has owner access to that project.

### Option A — Supabase CLI (recommended)

```bash
# 1. Log in with the account that OWNS the project
supabase login

# 2. Link the local repo to the project (will ask for the DB password)
supabase link --project-ref frcmgkayluazwkokywux

# 3. Apply all pending migrations
supabase db push
```

### Option B — SQL Editor (no CLI)

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the contents of **`supabase/apply-all.sql`** (a single combined,
   idempotent file that includes every migration) and click **Run**.
   Safe to re-run — everything is `IF NOT EXISTS`.

### Verify

Check which tables are applied (no secrets needed — uses the public anon key):

```bash
node scripts/migrate-supabase.js
```

The checker exits non-zero with a clear warning if the API is unreachable or
the anon key is rejected, so a "all tables present" result is trustworthy.

## Troubleshooting

- **Build hangs on turbopack cache** → `rm -rf .next dist` then `npm run build`.
  See `docs/NEXT_BUILD_TROUBLESHOOTING.md`.
- **Worker `/ably/token` returns 401** → a `TOKEN_AUTH_SECRET` is set on the
  worker but the app isn't sending it (or vice-versa). The app does not send a
  shared secret, so either unset `TOKEN_AUTH_SECRET` or authenticate the caller
  differently (see `docs/CLOUDFLARE_WORKERS.md`).
- **Realtime down at runtime** → if `NEXT_PUBLIC_API_BASE_URL` is set but the
  worker is unreachable, Ably falls back to Supabase realtime, not the bundled key.
- **Service-role key exposure** → the service-role key is server-side only.
  Enable RLS on all tables before sharing the app broadly (see
  `docs/CLOUDFLARE_WORKERS.md`).
