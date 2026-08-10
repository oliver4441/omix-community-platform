# Omix Community — Docs

- **Deployment:** [`DEPLOY.md`](./DEPLOY.md) — full guide (Firebase/Vercel frontend + Cloudflare Workers backend: gateway + domain services + cron)
- **Readiness:** [`DEPLOYMENT_READINESS.md`](./DEPLOYMENT_READINESS.md) — current checklist
- **Workers:** [`CLOUDFLARE_WORKERS.md`](./CLOUDFLARE_WORKERS.md) — API layer details, route table, and how to add a new endpoint
- **Build troubleshooting:** [`NEXT_BUILD_TROUBLESHOOTING.md`](./NEXT_BUILD_TROUBLESHOOTING.md)
- **Constitution:** [`CONSTITUTION.md`](./CONSTITUTION.md) — engineering principles

Backend layout: `workers/shared/` (env, util, push helpers) + `omix-gateway`
(the only public URL) + per-domain services (`omix-auth`, `omix-chat`,
`omix-social`, `omix-servers`, `omix-notifications`, `omix-uploads`) +
`omix-cron` (scheduled). Schema is D1 SQLite in `workers/migrations/`. See
[`AGENTS.md`](../AGENTS.md) for the module map and the route-adding walkthrough.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
