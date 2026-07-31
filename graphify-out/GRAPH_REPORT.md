# Omix Community — Knowledge Graph Report

Generated 2026-07-31 | 411 nodes | 496 edges | 35 communities

## God nodes (highest degree)
- OS Engineering Constitution (degree 18)
- compilerOptions (degree 16)
- ChatPane (degree 14)
- ChannelSidebar (degree 12)
- ServerRail (degree 11)
- NEXT.JS BUILD TROUBLESHOOTING GUIDE (degree 9)
- SERVICE ACCOUNT DEPLOYMENT GUIDE (For CI/CD automation) (degree 9)
- ErrorBoundary (degree 9)
- Store (degree 9)
- Message (degree 9)

## Communities
- C0 (43): App Shell & Core Screens
- C1 (36): Documented Architecture & Code Rules
- C2 (29): Shared UI Component Library
- C3 (28): Store State & Session Internals
- C4 (25): Dependency & Package Wiring
- C5 (24): Deployment Readiness Checklist Docs
- C6 (22): Build & Hosting Pipeline (Firebase)
- C7 (21): Chat Utilities & Date Handling
- C8 (20): Runtime Architecture & Admin Gating
- C9 (20): TypeScript Config (tsconfig)
- C10 (17): Deployment Ops Notes
- C11 (16): Next.js Build Troubleshooting
- C12 (15): Setup & Onboarding Guide
- C13 (13): PWA Manifest (manifest.json)
- C14 (12): Firebase Auth Setup Guide
- C15 (12): Firebase Deployment Status Log
- C16 (9): ErrorBoundary Component
- C17 (7): Manual Firebase Deploy Guide
- C18 (6): Root Layout & Metadata
- C19 (5): Emoji Picker
- C20 (4): README Intro
- C21 (4): Vercel Config
- C22 (3): Home Page
- C23 (3): Migration Plan Strategy
- C24 (2): Vercel Hosting Target
- C25 (2): ESLint Config
- C26 (2): PostCSS Config
- C27 (2): Firebase Messaging SW
- C28 (2): Service Worker Messaging
- C29 (2): Supabase Migration Script
- C30 (1): Migration Plan Doc
- C31 (1): Quick Migration Plan Doc
- C32 (1): Snake/Camel Case Serializers
- C33 (1): Next.js Env Types
- C34 (1): Icon Registry

## Surprising connections
- {'source': 'Supabase Migration Script', 'target': 'Client State Store (Store)', 'source_files': ['scripts/migrate-supabase.js', 'src/lib/store.ts'], 'confidence': 'INFERRED', 'relation': 'conceptually_related_to', 'why': 'inferred connection - not explicitly stated in source; connects across different repos/directories; peripheral node `Supabase Migration Script` unexpectedly reaches hub `Client State Store (Store)`'}
- {'source': 'FCM Service Worker', 'target': 'ChatPane', 'source_files': ['public/firebase-messaging-sw.js', 'src/features/chat/ChatPane.tsx'], 'confidence': 'AMBIGUOUS', 'relation': 'conceptually_related_to', 'why': 'ambiguous connection - not explicitly stated in source; connects across different repos/directories'}
- {'source': 'Service Worker (sw.js)', 'target': 'ChatPane', 'source_files': ['public/sw.js', 'src/features/chat/ChatPane.tsx'], 'confidence': 'AMBIGUOUS', 'relation': 'conceptually_related_to', 'why': 'ambiguous connection - not explicitly stated in source; connects across different repos/directories'}
- {'source': 'nextConfig', 'target': 'Lucide Icon Wrapper', 'source_files': ['next.config.ts', 'src/components/ui/icons.ts'], 'confidence': 'INFERRED', 'relation': 'references', 'why': 'inferred connection - not explicitly stated in source; connects across different repos/directories'}
- {'source': 'Static Build Artifacts (dist)', 'target': 'Production Build Artifacts', 'source_files': ['docs/DEPLOY.md', 'docs/DEPLOYMENT_READINESS.md'], 'confidence': 'INFERRED', 'relation': 'semantically_similar_to', 'why': 'inferred connection - not explicitly stated in source; semantically similar concepts with no structural link; peripheral node `Production Build Artifacts` unexpectedly reaches hub `Static Build Artifacts (dist)`'}

## Suggested questions
- How does the Admin Gating (config table) protect the app shell routes?
- What is the relationship between the Supabase migration and the Firebase auth flow?
- Which components depend on the Store state layer vs direct Firebase calls?
- What is the current deployment state per the status docs?
