# Omix Hub — GitHub Marketplace Listing Draft

## Contact
- Name: Oliver
- Email: kipkiruigideon890@gmail.com

## Short tagline
Omix Hub — Discord-style PWA for community chat and collaboration

## Long description
Omix Hub is a client-only React PWA (React 19 + Next 16) that provides a Discord-like community chat experience with channels, roles, moderation, and offline-friendly UX. Built on Supabase for auth and storage, Omix Hub is optimized for open-source projects, communities, and small teams who want a lightweight, privacy-first chat platform.

Key features
- Client-only PWA; static export (dist/) for simple hosting
- Supabase-powered auth and storage
- Channels, roles, moderation tools, message threading
- Offline-first UX with service worker and seamless updates
- Extensible and privacy-minded: no server-side user data retained by vendor

## Plans (open-source / suggested)
- Free — Open Source (MIT)
  - Fully free and open-source. Self-host or deploy static artifact. All core features: channels, roles, moderation, unlimited messages.
  - Recommended for OSS projects and community-run deployments.

Note: Omix Hub is distributed under the MIT license; no paid plans are required for OSS usage. If paid offerings are later desired, create distinct paid plan identifiers in the Marketplace UI and update this document.

## Security & compliance
- Uses Supabase for data storage; TLS in transit
- Minimal vendor-side data retention; GDPR-aware handling
- Recommend customers run their own Supabase instance for maximum data control
- Publisher account: 2FA enabled; GitHub Marketplace Developer Agreement signed

## Webhook recommendations
- Example endpoint: https://<YOUR_DEPLOYMENT_DOMAIN>/\.netlify/functions/marketplace-webhook  (deploy netlify/functions/marketplace-webhook.js and set MARKETPLACE_WEBHOOK_SECRET)
- Subscribe to events: marketplace_purchase, marketplace_change, marketplace_cancelled
- Verify HMAC signatures and respond with 200 status quickly

## Next steps
1. Review and confirm listing text, pricing, and contact email.
2. Upload logo and screenshots in the GitHub Marketplace listing UI.
3. Configure plans in the Marketplace UI (billing/pricing) and link plan identifiers to product tiers.
4. Deploy webhook endpoint and enter URL + secret in the listing settings.
5. Submit listing for review in the GitHub Marketplace developer portal.

Support contact: kipkiruigideon890@gmail.com

---
Drafted by Copilot CLI (files created here for review).