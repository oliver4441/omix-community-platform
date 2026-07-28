# OS Engineering Constitution

## Project Identity

You are building **OS (Omix Social)**.

OS is a community-first Progressive Web App developed by Omix Systems.

The objective is to create a platform inspired by the strongest aspects of WhatsApp, Telegram, and Discord while establishing a distinct identity.

Do not copy layouts, branding, or interactions directly from those products.

## Core Philosophy

Every decision must prioritize:

- Speed
- Simplicity
- Reliability
- Privacy
- Accessibility
- Mobile-first
- Offline-first

If a feature makes the application slower or more complex without clear user value, do not implement it.

## Product Vision

OS is not a social media platform.

OS is not an AI application.

OS is not a Discord clone.

OS is a modern community platform.

Communities are the primary product.

Messaging supports communities.

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js |
| Hosting | Vercel |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Push Notifications | Firebase Cloud Messaging |
| Voice and Video | Jitsi Meet |
| Offline Storage | IndexedDB |
| PWA | Service Worker |

## Architecture Rules

### Always
- Modular architecture
- Feature-based folders
- TypeScript
- Strict typing
- Reusable components
- Lazy loading
- Code splitting
- Responsive layouts
- Accessibility

### Never
- Monolithic components
- Massive files
- Duplicate logic
- Inline styles
- Hardcoded colors
- Hardcoded API endpoints

## Design System

| Token | Value |
|---|---|
| Theme | Dark-first |
| Corners | 20px |
| Spacing | 8-point grid |
| Animation | Subtle |
| Typography | Readable |
| Icons | Lucide |
| Primary color | Purple |
| Accent color | Blue |
| Background | Very dark navy |

## UI Principles

Every page should answer:

- Can the user understand this in under 3 seconds?
- Can it be used one-handed?
- Can it work on a 360px phone?
- Would it still feel good on desktop?

## Performance Budget

- Initial load: <150 KB JS (where practical)
- Time to Interactive: <3 seconds on average mobile networks
- Navigation: Instant after first load
- Images: Lazy loaded
- Lists: Virtualized
- Animations: 60 FPS

## PWA Rules

- Must be installable
- Must work offline
- Must cache navigation
- Must support push notifications
- Must support background sync
- Must survive network interruption

## Security

- Never trust client input
- Validate everything
- Least-privilege access
- Use Firestore Security Rules
- Encrypt private chats where applicable
- Never expose secrets
- Never commit API keys

## UX Rules

- No unnecessary dialogs
- No popup overload
- No page reloads
- Prefer bottom sheets on mobile
- Use skeleton loaders
- Provide clear empty states

## Accessibility

- Keyboard navigation
- ARIA labels
- High contrast
- Visible focus states
- Large touch targets
- Screen reader support

## Code Quality

- Every component: single responsibility
- Every hook: single responsibility
- Every function: pure where possible
- No function over ~50 lines without justification
- Avoid deeply nested conditionals

## Git Workflow

- Small commits
- Descriptive messages
- One feature per branch
- Document breaking changes
- Update documentation with every feature

## Definition of Done

A task is complete only if:

- Feature implemented
- Responsive
- Accessible
- Offline considered
- Error states handled
- Loading states implemented
- Empty states implemented
- Type-safe
- Tested
- Documented

## Agent Behaviour

Agents should not guess.

If requirements are ambiguous:
- Ask for clarification, or
- Propose options with trade-offs.

Do not invent APIs, database fields, or business rules.

## Specialized Agents

| Agent | Responsibility |
|---|---|
| Product Architect | Maintains overall architecture and consistency |
| UI/UX Engineer | Implements layouts, components, and interactions |
| Frontend Engineer | Builds Next.js pages, state management, and PWA behavior |
| Backend Engineer | Firebase Auth, Firestore, Storage, Cloud Functions |
| Database Architect | Firestore collections, indexes, and security rules |
| PWA Engineer | Service workers, offline caching, installability, background sync |
| Real-time Systems Engineer | Messaging, presence, typing indicators, read receipts |
| Security Engineer | Authentication, authorization, validation, and threat review |
| Performance Engineer | Bundle size, rendering, caching, lazy loading, Core Web Vitals |
| QA Engineer | Testing, accessibility, cross-browser, regression testing |
| Technical Writer | Keeps documentation synchronized with implementation |

Finally, designate one lead agent (Product Architect) as the only authority allowed to approve architectural changes. All other agents should work within that architecture rather than redefining it independently. This keeps the project coherent as it grows.
