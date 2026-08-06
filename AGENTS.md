# AGENTS.md

Discord-style chat **PWA** (React 19, Next 16). Client-only static app — there are no server routes or server actions; everything runs in the browser.

## Stack (don't get this wrong)
- **Data/auth = Supabase**, not Firebase. Creds are hardcoded in `src/lib/supabase.ts` (no `process.env` / `.env` needed, and none exist). Migrations live in `supabase/migrations/`, run via `scripts/migrate-supabase.js`.
- `firebase` package is legacy and **not imported anywhere in `src/`** — only used as an image remote-pattern in `next.config.ts`. Don't add "fix" Firebase code; the app is Supabase.
- DB uses **snake_case** columns; map with the `toCamel` / `toSnake` helpers in `src/lib/supabase.ts` rather than ad-hoc renaming.

## Commands
- `npm run dev` — dev server on :3000
- `npm run build` — static export (see gotcha below)
- `npm run lint` — eslint (flat config). There is **no test or typecheck script**; `next build` performs the TS typecheck.

## Build / deploy gotchas
- `next.config.ts` sets `output: "export"` and `distDir: "dist"` → build emits a **static `dist/`**, not the default `out/`. Firebase Hosting serves `dist/` as its public dir.
- Builds can time out on turbopack cache. If it hangs, `rm -rf .next dist` and rebuild. See `docs/NEXT_BUILD_TROUBLESHOOTING.md`.
- Deploy has **two documented targets** — Firebase Hosting (project `omix-systems-cd1af`, requires `firebase login`; `firebase deploy --only hosting`) and Vercel (`vercel.json`). See `docs/DEPLOY.md`. Auth is the usual blocker.
- Remember `path alias @/*` → `src/*`.

## Structure / conventions
- Features are split per domain under `src/features/` (`auth`, `channels`, `chat`, `communities`, `servers`, `settings`); shared UI in `src/components/`; global state in `src/lib/store.ts`.
- Auth goes through the `useAuth` context (`src/hooks/useAuth.tsx`); use it instead of calling Supabase directly.
- PWA: `public/sw.js` plus install/update banners; service worker auto-refreshes and clears cache on update — don't block builds on stale SW.

## Generated / ignore-worthy
`dist/`, `.next/`, `graphify-out/` (one-off knowledge-graph artifact), `tsconfig.tsbuildinfo` are generated or committed snapshots — regenerate/ignore rather than hand-edit.