# Omix Hub

Omix Hub is a client-only PWA (React 19, Next 16) that provides a Discord-style community chat experience. It's designed for self-hosting and static deployment (dist/), backed by a **Cloudflare Workers** API: an `omix-gateway` worker (sessions, routing, Ably tokens) in front of per-domain service workers (`omix-auth`, `omix-chat`, `omix-social`, `omix-servers`, `omix-notifications`, `omix-uploads`) sharing a D1 database and KV file storage.

Quickstart

- Install: npm ci
- Dev: npm run dev (runs Next dev server)
- Build: npm run build (project configured to export a static site to dist/)
- Serve dist/: use a static server (e.g., serve, Netlify, Firebase Hosting)
- Workers: npm run workers:typecheck (typecheck the backend workers)

Development

- Use the existing path aliases ("@/*" → src/*).
- Backend: Cloudflare Workers under `workers/` — gateway + per-domain services, D1 migrations in `workers/migrations/`. See `docs/CLOUDFLARE_WORKERS.md` (architecture + how to add a route) and `docs/DEPLOY.md` (deploy runbook).

CI/CD

- CI: GitHub Actions workflow (.github/workflows/ci.yml) runs lint and build on push and PRs.
- CD: workers deploy via .github/workflows/deploy-workers.yml; frontend deploys via Netlify (.github/workflows/deploy-netlify.yml) on push to master/main. Configure these repository secrets in GitHub:
  - NETLIFY_AUTH_TOKEN (Netlify personal token)
  - NETLIFY_SITE_ID (target Netlify site id)
  - CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID (workers deploy — see docs/DEPLOY.md)

Marketplace & Publishing

- Marketplace draft: MARKETPLACE_LISTING.md
- Assets for Marketplace: public/marketplace/icon.svg and screenshots
- Webhook example (Netlify function): netlify/functions/marketplace-webhook.js
- Recommended steps: deploy webhook, set MARKETPLACE_WEBHOOK_SECRET, upload assets in Marketplace UI, set listing to Free (MIT), then submit for review.

Contributing

- Run npm run lint before opening PRs.
- Keep PRs small and focused per feature.

Contact

- Oliver — kipkiruigideon890@gmail.com

---
Drafted by Copilot CLI — updated with CI/CD instructions and Marketplace guidance.
