# Omix Community Platform — Production Upgrade Plan

Incremental upgrade of the existing codebase (no rebuild). Audit date: 2026-08-13.

## Current architecture (audited)

- **Frontend** — Next.js 16 client-only static export PWA (`output: "export"`), React 19,
  Tailwind 4 design tokens in `src/app/globals.css`. Global state lives in a monolithic
  `Store` singleton (`src/lib/store.ts`, ~1,200 lines) that mixes API calls, 10-second
  polling loops, Ably realtime, localStorage, and UI concerns. Navigation via `window`
  CustomEvents (`serverChanged` / `channelChanged`) + an `AppView` union.
- **Backend** — one Cloudflare Worker (`workers/omix-api`) with D1 (SQLite) + KV asset
  storage + custom session auth (email/password, GitHub OAuth). Supabase migrations under
  `supabase/` are legacy and unused by the app.
- **Realtime** — Ably (`@ably/chat` rooms) for messages/presence/typing; WebRTC 1:1 calls
  in `src/lib/calls.ts`; `@jitsi/react-sdk` is a declared dependency but unused.
- **Features present** — auth, workspaces (servers), channels, chat (replies, threads,
  pins, reactions, mentions, file uploads), DMs, presence/typing, 1:1 calls, boardroom
  forum, external feed, profiles/settings, workspace discovery, PWA (sw.js, manifest).

## Problems found during audit

1. `next build` is broken on master: `BoardroomFeed` imports missing `@/components/Markdown`.
2. Mobile navigation is dead: `ChannelSidebar` hides itself on mobile (checks a
   `"channels"` view that does not exist) with no replacement — mobile users cannot
   switch channels.
3. Store monolith: duplicated subscriptions (AppLayout + WorkspaceRail both poll
   `/servers`), no refcounting, leaked intervals (e.g. `setPresence` heartbeat),
   polling continues on hidden tabs, no error/retry/offline states.
4. No backend RBAC: any authenticated user can DELETE servers/channels, pin messages,
   etc. Roles exist as strings (`role` column) but nothing enforces them.
5. No rate limiting, flood/raid protection, or mass-mention caps.
6. No moderation (reports, warn/mute/timeout/kick/ban), no audit log, no edit history.
7. Search is client-side over the current channel only; no global search or filters.
8. No notification center (FCM stub only); no per-channel notification settings.
9. No offline support: no IndexedDB cache, no outbox queue, drafts not persisted.
10. Uploads validated by size only; SVG served inline (XSS risk).
11. No tests, no typecheck script.

## Implementation order (P0 first)

### P0-A — Repair & tooling ✅ DONE
- [x] Add safe dependency-free `src/components/Markdown.tsx` (fixes broken build).
- [x] Add `vitest` + `npm test`, `npm run typecheck` scripts.

### P0-B — Backend: security, RBAC, moderation, rate limits, search, notifications ✅ DONE
- [x] Migration `0005` (`workers/migrations/`): audit_log, reports, moderation_actions,
      message_edits (edit history), events, notification_overrides, channel_permission_overrides,
      mutes/bans on server_members, message `deleted` tombstone + `nonce` columns,
      rate_limits table, notification `read` column.
- [x] `workers/omix-api/src/permissions.ts` — capability matrix for
      Owner/Admin/Moderator/Manager/Member/Guest/Bot + channel override support.
- [x] `workers/omix-api/src/ratelimit.ts` — D1 sliding-window rate limiter + message
      flood guard; mass-mention cap in crud; auth rate limits in auth.ts.
- [x] Enforce RBAC in `crud.ts`: membership checks, role gates on all mutations, author
      enforcement (server-side display names) on edits/deletes, edit history,
      tombstone deletes; `/servers` no longer leaks private communities.
- [x] Upload hardening: content-type allowlist per kind, reject SVG/HTML, `nosniff`
      + CSP sandbox headers on `/assets/*`.
- [x] Moderation routes: reports, moderation queue (staff-gated), warn/mute/timeout/
      kick/ban/unban, audit log (staff read), member directory.
- [x] `GET /search` — global search across messages/DMs/users/communities/channels/
      files/events with `from:`, `in:`, `before:`, `after:`, `has:` filters, behind a
      `SearchService` abstraction (semantic search plugs in later).
- [x] Notifications: list/unread/read/read-all endpoints; worker generates notifications
      for mentions, replies, DMs, reactions, invites, moderation; per-channel overrides
      (default/all/mentions/muted) respected at ingest.

### P0-C — Frontend service layer (backward-compatible) ✅ DONE
- [x] `src/lib/services/` modules: `events`, `subscriptions` (refcounted, deduped,
      visibility/offline-aware polling), `connection` (online/offline/reconnecting),
      `permissions` (client RBAC mirror), `storage` (IndexedDB), `outbox` (offline
      queue + drafts), `media` (upload progress + validation), `notifications`,
      `search`, `moderation`.
- [x] `src/lib/store.ts` rewritten as a facade over services — every existing method
      signature preserved (backward compatibility).
- [x] Leaks fixed: every interval tracked, polls deduped by refcount, polling paused
      when tab hidden / offline, Ably rooms released when the last channel subscriber
      leaves; global polls (servers/DMs/stats) no longer die on channel switches
      (fixes frozen workspace/DM lists); `cleanupChannel()` vs `cleanup()` scoping.
- [x] Offline-first: IndexedDB outbox queue for messages (replay on reconnect, server
      dedupe by nonce), per-channel drafts persisted, recent messages cached and
      replayed while offline.
- [x] Loading/error/retry states (`messagesStatus` events, `retryMessages`,
      connection status, offline banner).

### P0-D — UX: notifications, search, mobile ✅ DONE
- [x] Notification center: bell + unread badge (header + mobile nav), panel,
      mark-read / mark-all-read, click-to-navigate.
- [x] Global search modal with filter chips and grouped results.
- [x] Mobile navigation model: full-screen community → channel → conversation drawer
      (back button, create channel, DM entry), bottom tabs with unread badges.
      Desktop layout unchanged. Markdown + report + pending-send + upload-progress
      wired into chat.

### P0-E — Quality gates ✅ DONE
- [x] Vitest tests (25): permissions matrix + client/server parity, moderation
      hierarchy, search filter parsing, XSS-safe Markdown, upload validation.
- [x] `npm run lint` (0 errors) && `npm run typecheck` && `npm test` && `npm run build`
      all green (build verified with a temporary system-font layout because this
      sandbox cannot reach fonts.googleapis.com; original next/font layout restored).

## P1+ (next increments, after P0 is stable)

- P1: threads v2 (unread counts, notifications), media previews/progress, profiles v2,
  events UI, Jitsi voice/video rooms, community discovery polish.
- P2: analytics dashboard, developer platform (webhooks, API keys, bots, slash
  commands), AI layer (summaries/digests — opt-in, token-thrifty), knowledge layer
  (FAQ/articles from saved threads).
- P3: monetization/federation — only after the core is stable.

## Backward-compatibility rules

- Keep the `Store` singleton's public API identical (components import it everywhere).
- Keep all existing REST endpoints and their response shapes; add new ones only.
- Keep the existing Ably room ids (`chat-*`, `dm-*`, `presence-main`) and window
  CustomEvents so existing features (calls, typing, presence) keep working.
