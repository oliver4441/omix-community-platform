# AGENTS.md

Discord-style chat **PWA** (React 19, Next 16). Client-only static app — there are
no server routes or server actions; everything runs in the browser and talks to a
**Cloudflare Workers backend** (`omix-gateway` + per-domain service workers).

## Architecture (don't get this wrong)

```
Frontend (Next.js static PWA)  ->  omix-gateway  ->  omix-auth · omix-chat · omix-social
        src/                      (public URL)      omix-servers · omix-notifications · omix-uploads
                                                          │
                                                          └─ D1 (SQLite) + KV (files) + Ably
                                                    omix-cron (scheduled every 5 min)
```

- **Backend = Cloudflare Workers**, not Supabase and not Firebase. The old
  Supabase stack has been fully removed — there is no `src/lib/supabase.ts`, no
  Supabase migrations. The `firebase` npm package is legacy and **not imported
  anywhere in `src/`** — only used as an image remote-pattern in `next.config.ts`.
  Don't add "fix" Firebase/Supabase code.
- `omix-gateway` is the **only public backend URL** (`NEXT_PUBLIC_API_BASE_URL`).
  It owns CORS, session validation, `/health`, `/ably/token`, `/assets/*` and
  `/push/vapid-public-key`, then routes everything else to the owning domain
  worker via service bindings, stamping the caller as `X-Omix-User-*` headers.
- Domain workers are `workers_dev = false` with no routes → unreachable from the
  internet; they trust the gateway-stamped identity (`sessionFromHeaders` in
  `workers/shared/util.ts`).
- DB is **D1** (SQLite) with **snake_case** columns. Schema lives in
  `workers/migrations/` as numbered SQL files. File uploads live in **KV**
  (`ASSETS` binding, free tier).

### Worker directory map

| Path | Domain |
| ---- | ------ |
| `workers/shared/` | `env.ts` (Env interface), `util.ts` (json/CORS/session helpers, `withUserHeaders`/`sessionFromHeaders`), `push.ts` (web-push crypto) |
| `workers/omix-gateway/` | edge: CORS, sessions, `/ably/token`, `/health`, route table (`routeFor`) |
| `workers/omix-auth/` | signup/login/verify/reset, sessions, GitHub OAuth + webhook, email |
| `workers/omix-chat/` | channel messages, threads, pins, reactions, DM channels, typing |
| `workers/omix-social/` | profiles, stats/XP, presence, boardroom posts, snippets, dev feed |
| `workers/omix-servers/` | servers, channels, invites, app config/admin, call log |
| `workers/omix-notifications/` | notification settings, push subscriptions, push send |
| `workers/omix-uploads/` | `/upload` (KV) + `/assets/*` serving |
| `workers/omix-cron/` | scheduled: typing/presence cleanup, feed ingest, queued push delivery |
| `workers/feed/ingest.ts` | feed fetchers, shared by `omix-social` and `omix-cron` |

Each domain service has a thin `src/index.ts` entry (session check →
`sessionFromHeaders` → chain of `handle*` functions) plus one or more domain
modules (e.g. `omix-servers/src/{servers,config,calls}.ts`).

## Commands

- `npm run dev` — frontend dev server on :3000
- `npm run build` — static export to `dist/` (gotcha below)
- `npm run lint` — eslint (flat config)
- `npm run workers:typecheck` — `tsc -p workers/tsconfig.json` (all workers + shared)
- `npm run workers:dev` — `wrangler dev` on the gateway (local service bindings)
- `npm run workers:deploy` — deploys services → gateway → cron (order matters!)

There is **no test script**; `next build` performs the frontend TS typecheck.

## Build / deploy gotchas

- `next.config.ts` sets `output: "export"` and `distDir: "dist"` → build emits a
  static `dist/`, not the default `out/`. Firebase Hosting serves `dist/`.
- The frontend's `NEXT_PUBLIC_API_BASE_URL` must point at the **gateway** URL
  (`https://omix-gateway.<subdomain>.workers.dev`), baked in at build time.
- Workers deploy **services before the gateway** (service bindings resolve by
  worker name). See `docs/DEPLOY.md` for the full runbook.
- Builds can time out on turbopack cache. If it hangs, `rm -rf .next dist` and
  rebuild. See `docs/NEXT_BUILD_TROUBLESHOOTING.md`.
- Remember `path alias @/*` → `src/*`.

## Frontend structure / conventions

- Features split per domain under `src/features/`; shared UI in `src/components/`;
  global state in `src/lib/store.ts`; backend calls in `src/lib/api.ts`.
- Auth goes through the `useAuth` context (`src/hooks/useAuth.tsx`).
- PWA: `public/sw.js` plus install/update banners; SW auto-refreshes on update.

## How to add a new backend route

Every API route is owned by exactly one domain service. Adding one is a
4-step change (no deploy orchestration needed — `workers:deploy` handles it):

**1. Pick the owning service** from the table above. If the route doesn't fit an
existing domain, that's a sign to create a new service dir (copy an existing
`wrangler.toml` + `src/index.ts` pattern) and add a binding in the gateway.

**2. Implement the handler** in the domain module. Handlers are
`(request, env, user) => Promise<Response | null>` — return `null` for
routes you don't own. Example in `workers/omix-chat/src/chat.ts`:

```ts
export async function handleChat(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;

  if (p === "/dm-channels" && method === "POST") {
    // user is the authenticated SessionUser (stamped by the gateway)
    return json({ ok: true }, 200, env);
  }
  return null; // not ours — let the next handler try
}
```

**3. Wire it up.**

- If the handler lives in a **new module file**, chain it in the service's
  `src/index.ts` entry (e.g. `(await handleX(...)) || (await handleY(...))`).
- Add the route prefix to the gateway's `routeFor()` in
  `workers/omix-gateway/src/index.ts` so requests reach the right service.
  **Order matters**: more specific prefixes first (e.g. the
  `/channels/:id/messages|pins` regex precedes the `/channels/` catch-all).
  If the route is public (no session), return it **before** the `requireUser`
  gate in the gateway's `fetch`.
- If it touches new tables/columns, add `workers/migrations/000N_name.sql`
  (next number after `0007_web_push.sql`); migrations apply via CI / `d1
  migrations apply --remote`.

**4. Call it from the frontend** in `src/lib/api.ts` (it prefixes
`API_BASE_URL`), then `npm run workers:typecheck && npm run lint` locally.

> **Session vs public:** authenticated routes are handled after the gateway's
> `requireUser` gate and receive `user` for free. Public routes (health, token,
> assets, webhook) are answered at the gateway edge or forwarded without a
> session stamp — don't put auth-required logic there.

## Generated / ignore-worthy

`dist/`, `.next/`, `graphify-out/` (one-off knowledge-graph artifact),
`tsconfig.tsbuildinfo`, `workers/**/.wrangler/` are generated or committed
snapshots — regenerate/ignore rather than hand-edit.
