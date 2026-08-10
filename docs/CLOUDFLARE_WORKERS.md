# Cloudflare Workers API layer

The backend is a **microservice set behind a gateway**:

```
Frontend (Next.js static PWA)  ->  omix-gateway  ->  omix-auth · omix-chat · omix-social
        src/                       (public)          omix-servers · omix-notifications · omix-uploads
                                                          │
                                                          └─ D1 (SQLite) + KV (files) + Ably
```

`omix-gateway` is the **only public URL**. It owns CORS, session validation,
Ably token minting and the public endpoints, then forwards each route to the
domain worker that owns it via **service bindings**. Domain workers have
`workers_dev = false` and no routes, so they are unreachable from the internet —
they trust the `X-Omix-User-*` identity headers the gateway stamps on the request
(`withUserHeaders` / `sessionFromHeaders` in `workers/shared/util.ts`).

Why split? Each domain is a small, independently deployable unit (a change to
chat routing deploys only `omix-chat`), and a future domain can scale out
separately. The cost is a single session lookup per request at the gateway —
cheap with D1 and one query.

## Workers

| Worker               | Purpose                                                       | Trigger |
| -------------------- | ------------------------------------------------------------- | ------- |
| `omix-gateway`       | CORS, sessions, `/health`, `/ably/token`, `/assets/*`, `/push/vapid-public-key`, `/github/webhook`, routing | HTTP (`fetch`) |
| `omix-auth`          | signup/login/verify/reset, sessions, GitHub OAuth + webhook, email | HTTP (internal) |
| `omix-chat`          | channel messages, threads, pins, reactions, DM channels, typing | HTTP (internal) |
| `omix-social`        | profiles, stats/XP, presence, boardroom, snippets, dev feed    | HTTP (internal) |
| `omix-servers`       | servers, channels, invites, app config/admin, call log         | HTTP (internal) |
| `omix-notifications` | notification settings, push subscriptions, push send           | HTTP (internal) |
| `omix-uploads`       | `/upload` (KV) + `/assets/*` serving                           | HTTP (internal) |
| `omix-cron`          | typing/presence cleanup, feed ingest, queued push delivery     | Cron (`*/5 * * * *`) |

### Gateway route table

| Path | Service |
| ---- | ------- |
| `/health`, `/ably/token`, `/push/vapid-public-key`, `/github/webhook` | gateway itself (edge) |
| `/auth/*`, `/github/*`, `/profiles/:id/github` | omix-auth |
| `/messages/*`, `/dm-channels`, `/typing`, `/threads/*`, `/channels/:id/messages|pins` | omix-chat |
| `/servers`, `/servers/*`, `/channels/*`, `/invites/*`, `/config/*`, `/admin/*`, `/call-log` | omix-servers |
| `/profiles`, `/profiles/*`, `/stats/*`, `/presence`, `/me/status`, `/board-posts/*`, `/snippets/*`, `/feed*` | omix-social |
| `/notification-settings*`, `/push/*` | omix-notifications |
| `/upload`, `/assets/*` (public) | omix-uploads |

> Auth routes are forwarded **before** the session gate (signup/login are
> public). The auth service validates sessions itself (it owns the `sessions`
> table). Everything else is session-checked by the gateway first.

## Adding a new endpoint

Every route is owned by exactly one domain service; the gateway only routes.

1. **Pick the owning service** from the table above. Handlers live in the
   service's domain modules (e.g. `workers/omix-chat/src/chat.ts`) and follow
   the signature `(request, env, user) => Promise<Response | null>` — return
   `null` for routes you don't own.
2. **Chain the handler** in the service entry `src/index.ts` if it lives in a
   new module: `(await handleA(...)) || (await handleB(...))`.
3. **Register the prefix** in `routeFor()` in
   `workers/omix-gateway/src/index.ts`. Order matters — put specific patterns
   (e.g. `/channels/:id/messages`) before generic ones (e.g. `/channels/`).
   If the route is **public**, answer it before the `requireUser` gate in the
   gateway's `fetch` instead (like `/health`, `/ably/token`, `/assets/*`).
4. **Schema**: if the route touches new tables/columns, add the next numbered
   file in `workers/migrations/` (currently up to `0007_web_push.sql`).
   Migrations apply automatically in CI (`d1 migrations apply --remote`).
5. **Frontend**: add the call in `src/lib/api.ts` (prefixes `API_BASE_URL`),
   then `npm run workers:typecheck && npm run lint`.
6. **Deploy**: `npm run workers:deploy` (services before gateway).

Authenticated handlers receive the gateway-validated `SessionUser` for free;
public routes must not assume a session exists.

## Security model

- The gateway validates the session (`getSessionUser`, D1) and stamps the
  caller as `X-Omix-User-*` headers.
- Services reconstruct the user from those headers and **do not** re-validate —
  they trust the gateway because they are internal-only (`workers_dev = false`,
  no routes).
- `TOKEN_AUTH_SECRET` on the gateway is **not set** — the browser's Ably client
  can't send a shared secret, so gating `/ably/token` would break realtime.

## Local development

```bash
npm install

# Local secrets (git-ignored) — copy the example and fill in real values
cp workers/omix-gateway/.dev.vars.example workers/omix-gateway/.dev.vars

# Run the gateway locally (http://localhost:8787)
# Domain services must be running locally too for service bindings to resolve;
# start them in separate terminals:
npx wrangler dev -c workers/omix-auth/wrangler.toml
npx wrangler dev -c workers/omix-chat/wrangler.toml
npx wrangler dev -c workers/omix-social/wrangler.toml
npx wrangler dev -c workers/omix-servers/wrangler.toml
npx wrangler dev -c workers/omix-notifications/wrangler.toml
npx wrangler dev -c workers/omix-uploads/wrangler.toml
npm run workers:dev          # ...then this for the gateway

# Typecheck all workers
npm run workers:typecheck

# Bundling check (no upload)
npx wrangler deploy -c workers/omix-gateway/wrangler.toml --dry-run
```

## One-time Cloudflare setup

1. Create a Cloudflare account, then a Workers API token with
   `Account > Workers Scripts > Edit` permission:
   https://dash.cloudflare.com/profile/api-tokens
2. Log in locally (opens a browser):
   ```bash
   npx wrangler login
   ```
3. Create the shared resources once (see `docs/DEPLOY.md` for full runbook):
   ```bash
   npx wrangler d1 create omix-db          # copy database_id into every wrangler.toml
   npx wrangler kv namespace create omix-assets   # copy id into workers/omix-uploads/wrangler.toml
   npx wrangler d1 migrations apply omix-db --remote --config workers/omix-chat/wrangler.toml
   ```
4. Set per-worker secrets (never commit them) — full list in `docs/DEPLOY.md`:
   ```bash
   echo "your-ably-key" | npx wrangler secret put ABLY_API_KEY -c workers/omix-gateway/wrangler.toml
   # …GITHUB_* / RESEND_API_KEY on omix-auth, VAPID_PRIVATE_KEY on gateway+notifications+cron
   ```
5. Deploy (services first, gateway last):
   ```bash
   npm run workers:deploy
   ```

## CI/CD (GitHub Actions)

`.github/workflows/deploy-workers.yml` deploys all workers on push to `master`
(any changes under `workers/`): migrations → 6 domain services → gateway → cron,
then attaches secrets per worker. Add these repo secrets:

| Secret                         | Value                                        |
| ------------------------------ | -------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`         | Workers API token (Edit permission)          |
| `CLOUDFLARE_ACCOUNT_ID`        | Your Cloudflare account ID                   |
| `ABLY_API_KEY`                 | Ably API key                                 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app                    |
| `RESEND_API_KEY`               | Resend API key                               |
| `VAPID_PRIVATE_KEY`            | Web Push VAPID private key                   |

To also deploy the frontend in the same workflow, append a job that runs
`npm run build` and uploads `dist/` (Firebase Hosting or Vercel) — the worker
deploy is intentionally a separate, focused job.

## Wiring the frontend

The frontend already has an API client (`src/lib/api.ts`) with graceful
fallbacks:

- **Ably tokens:** `src/lib/ably.ts` uses the gateway's `/ably/token` endpoint
  automatically **when** `NEXT_PUBLIC_API_BASE_URL` is set at build time;
  otherwise it falls back to the hardcoded key.
- **Push notifications:** subscription + send go through
  `/push/subscription` and `/push/send` on the gateway.

To go live with the gateway:

```bash
# Build the static export with the API pointed at the gateway
NEXT_PUBLIC_API_BASE_URL=https://omix-gateway.<your-subdomain>.workers.dev npm run build
```

Once the gateway handles auth for everything, remove the fallback `ABLY_KEY`
from `src/lib/ably.ts` so the key no longer ships in the bundle at all.
