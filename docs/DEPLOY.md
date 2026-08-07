# Omix Community — Deployment Guide

## Architecture

```
Frontend (Next.js static PWA)  ->  omix-api (Cloudflare Worker)  ->  D1 (SQLite) + KV (files)
        src/                         workers/omix-api/                    ^
                                                      └── Ably (realtime chat, token minted here)
                                 omix-cron (Cloudflare Worker, cleanup every 5 min)
```

| Tier      | Tech                                                              | Deploy target               |
| --------- | ----------------------------------------------------------------- | --------------------------- |
| Frontend  | Next.js 16 + React 19, static export to `dist/`                   | **Firebase Hosting** (primary) / Vercel |
| API       | `omix-api` Worker — auth, CRUD, uploads, Ably tokens              | Cloudflare Workers          |
| Cron      | `omix-cron` Worker — typing/presence cleanup (`*/5 * * * *`)      | Cloudflare Workers          |
| Data      | **D1** (SQLite, replaces Supabase Postgres)                       | Cloudflare D1               |
| Storage   | **KV** (free tier, no billing — replaces Supabase Storage / R2)     | Cloudflare KV               |
| Auth      | Custom in-worker (email/password PBKDF2 + GitHub OAuth)           | Cloudflare Workers + Resend |
| Email     | Resend (verification + password reset)                            | resend.com                  |
| Realtime  | Ably (token issued by `omix-api`)                                 | ably.com                    |

> **Stack note:** Supabase has been fully removed — there is no `src/lib/supabase.ts`,
> no Supabase secrets, and no Supabase migrations anymore. The `firebase` npm
> package is only an image remote-pattern in `next.config.ts`; Firebase Hosting
> is used solely to serve the static `dist/`.

## Current deployment state

Live as of this writing (account `549a05783941248fb5a7f53ede7c54fa`,
`kipkiruigideon890@gmail.com`):

| Resource                | Value                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| omix-api worker         | `https://omix-api.kipkiruigideon890.workers.dev` ✅ healthy           |
| omix-cron worker        | `https://omix-cron.kipkiruigideon890.workers.dev` ✅ cron `*/5`       |
| D1 database `omix-db`   | `55de740c-6c82-4291-b3ad-621398eb4854` ✅ migrated (22 app tables)  |
| Frontend (Firebase)     | `https://omix-systems-cd1af.web.app` ✅                               |
| Storage `omix-assets`   | KV namespace `0200ed9d4dd542d184fb2bcb9b24f363` ✅ (upload tested)    |
| Secrets                 | `ABLY_API_KEY` set; `RESEND_API_KEY`, `GITHUB_*` pending (see step 5) |

## Prerequisites

- Cloudflare account (no paid services — D1, KV and Workers all have free tiers).
- Ably API key (a working key is already bundled in `src/lib/ably.ts` as a fallback).
- Resend API key (transactional email — required for signup verification / reset).
- GitHub OAuth app (only if you want the "Continue with GitHub" button).
- For the frontend: Firebase CLI login (or a Vercel token).

## Backend — Cloudflare Workers runbook

### 1. Authenticate wrangler

```bash
npx wrangler login          # browser OAuth — one-time
npx wrangler whoami         # confirm account id (549a05783941248fb5a7f53ede7c54fa)
```

### 2. Create the D1 database

```bash
npx wrangler d1 create omix-db
```

Copy the returned `database_id` into **both** `workers/omix-api/wrangler.toml`
and `workers/omix-cron/wrangler.toml` (`[[d1_databases]]` blocks).

### 3. Apply migrations

Schema lives in `workers/migrations/` (SQLite). **You must pass `--remote`** —
without it wrangler applies to the *local dev state* only:

```bash
npx wrangler d1 migrations apply omix-db --remote --config workers/omix-api/wrangler.toml
# → "Executed 44 commands" / each migration ✅
```

Verify:

```bash
npx wrangler d1 execute omix-db --remote --config workers/omix-api/wrangler.toml \
  --command "SELECT count(*) FROM sqlite_master WHERE type='table'"
```

(The count includes SQLite system tables — `sqlite_sequence`, `d1_migrations` —
so expect 24–25, i.e. the 22 app tables.)

### 4. File storage (KV — free, no R2 activation/billing)

Uploads (avatars, icons, files) are stored in a **Cloudflare KV** namespace.
KV is free on every account — no R2 activation, no credit card, no `10042`.

```bash
npx wrangler kv namespace create omix-assets
```

Copy the returned `id` into `workers/omix-api/wrangler.toml`
(`[[kv_namespaces]]` block). Limits: **25 MB per value** (the app caps uploads
at 20 MB) and **eventual consistency** — a freshly uploaded file may take a
few seconds to be readable globally.

Uploaded files are served publicly at `/assets/*` (no auth header — browsers
load them in `<img>` tags), while the `/upload` endpoint itself requires a
session.

### 5. Secrets

Set per worker (`--config` flag selects it). Secrets are never committed.

```bash
echo "your-ably-key" | npx wrangler secret put ABLY_API_KEY       --config workers/omix-api/wrangler.toml
echo "your-resend-key" | npx wrangler secret put RESEND_API_KEY    --config workers/omix-api/wrangler.toml
echo "your-client-id" | npx wrangler secret put GITHUB_CLIENT_ID   --config workers/omix-api/wrangler.toml
echo "your-client-secret" | npx wrangler secret put GITHUB_CLIENT_SECRET --config workers/omix-api/wrangler.toml
echo "Omix <you@domain.com>" | npx wrangler secret put EMAIL_FROM --config workers/omix-api/wrangler.toml   # optional
```

| Secret | Required? | Effect if missing |
| ------ | --------- | ----------------- |
| `ABLY_API_KEY` | ✅ | Realtime chat fails |
| `RESEND_API_KEY` | ✅ (for email signups) | Signup reports "check your email" but **no email is sent** |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | only for GitHub OAuth | GitHub button 503s |
| `EMAIL_FROM` | no | default `onboarding@resend.dev` |
| `TOKEN_AUTH_SECRET` | ❌ **do not set** | The frontend's Ably client can't send it, so it 401s `/ably/token` and breaks realtime. Leave it unset. |

**Vars** (in `[vars]`, edit `wrangler.toml` + redeploy, or `secret put` to override):

- `APP_ORIGIN` — the frontend origin used in email links + GitHub OAuth
  redirects, e.g. `https://omix-systems-cd1af.web.app`.
- `CORS_ORIGIN` — allowed browser origin (same value); `*` in dev.

**GitHub OAuth callback URL** to register in the OAuth app:

```
https://omix-api.<your-subdomain>.workers.dev/auth/github/callback
```

### 6. Deploy both workers

```bash
npm run workers:typecheck          # tsc -p workers/tsconfig.json
npm run workers:deploy             # deploys omix-api then omix-cron
# or individually:
npx wrangler deploy --config workers/omix-api/wrangler.toml
npx wrangler deploy --config workers/omix-cron/wrangler.toml
```

### 7. Verify

```bash
curl https://omix-api.<subdomain>.workers.dev/health              # {"ok":true,...}
curl "https://omix-api.<subdomain>.workers.dev/ably/token?clientId=test"   # 200 → Ably token JSON
curl -X POST https://omix-api.<subdomain>.workers.dev/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret1","displayName":"You"}'   # {"ok":true,"needsVerification":true}
```

> `omix-cron` answers direct HTTP requests with `error code: 1101` — expected;
> it only handles scheduled events.

## Frontend — build + host

### 1. Build with the worker URL

`NEXT_PUBLIC_API_BASE_URL` is baked into the client **at build time** (`src/lib/api.ts`).

```bash
NEXT_PUBLIC_API_BASE_URL=https://omix-api.<subdomain>.workers.dev npm run build
```

If unset, the app renders but every API call throws `api_not_configured`
(realtime still tries the bundled Ably key). The built URL appears in
`dist/_next/static/chunks/*.js` — grep to confirm.

### 2. Firebase Hosting (primary)

`firebase.json` serves `dist/` with an SPA rewrite. `.firebaserc` pins
project `omix-systems-cd1af`.

> Package-name gotcha: the CLI is **`firebase-tools`**, so use `npx firebase-tools`,
> not `npx firebase`.

```bash
npx firebase-tools login --no-localhost        # one-time browser auth
npx firebase-tools deploy --only hosting
# Hosting URL: https://<project>.web.app
```

### 3. Vercel (alternative)

`vercel.json` already sets the framework/output (`dist`) and disables native Git
deploys (CI drives it). Manual:

```bash
npm run build
npx vercel pull --yes --environment=production
npx vercel build --prod          # passes NEXT_PUBLIC_API_BASE_URL from your env/secrets
npx vercel deploy --prebuilt --prod --yes
```

## CI / CD

Push to `master` triggers both workflows:

- **`.github/workflows/deploy-workers.yml`** (paths: `workers/**`) — typechecks,
  ensures the KV namespace, applies D1 migrations with `--remote`, deploys both
  workers, sets secrets.
- **`.github/workflows/deploy-frontend.yml`** (paths: `src/**`, `public/**`, …) —
  builds via `vercel build` with `NEXT_PUBLIC_API_BASE_URL` and deploys to
  Vercel production. (For Firebase CI, run the same steps with `firebase-tools`.)

**GitHub repo secrets** (Settings → Secrets → Actions):

| Secret | Used by | Value |
| ------ | ------- | ----- |
| `CLOUDFLARE_API_TOKEN` | workers CI | Workers + D1 + KV edit token |
| `CLOUDFLARE_ACCOUNT_ID` | workers CI | `549a05783941248fb5a7f53ede7c54fa` |
| `ABLY_API_KEY` | workers CI | Ably API key |
| `RESEND_API_KEY` | workers CI | Resend API key |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | workers CI | GitHub OAuth app |
| `VERCEL_TOKEN` | frontend CI | Vercel token (scope: full) |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | frontend CI | from `.vercel/project.json` |
| `NEXT_PUBLIC_API_BASE_URL` | frontend CI | worker URL (see above) |

Both workflows fail fast with a clear `::error::` if a required secret is
missing.

## Troubleshooting

- **Uploads 404 / error JSON immediately after upload** → KV's eventual
  consistency: wait a few seconds before reading a fresh key.
- **Migration "applied" but schema missing remotely** → you ran
  `d1 migrations apply` without `--remote` (it touched local state). Re-run
  with `--remote`.
- **`/ably/token` returns 401** → a `TOKEN_AUTH_SECRET` is set on the worker;
  the app's Ably client cannot send it. Delete the secret (or gate auth
  differently).
- **Signup succeeds but no verification email arrives** → `RESEND_API_KEY` is
  unset (emails are skipped silently).
- **GitHub button 503s** → `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` unset, or
  the callback URL isn't registered.
- **CORS errors from the app** → `CORS_ORIGIN` must match the app origin
  (`https://<app>.web.app`, not `*` in production).
- **`omix-cron` returns `1101` over HTTP** → expected; it's a scheduled-only worker.
- **Build hangs on turbopack cache** → `rm -rf .next dist` then `npm run build`
  (see `docs/NEXT_BUILD_TROUBLESHOOTING.md`).
- **Frontend can't reach the worker** → confirm `NEXT_PUBLIC_API_BASE_URL` is in
  the built bundle (`grep` `dist/`) and the worker's `/health` responds.
