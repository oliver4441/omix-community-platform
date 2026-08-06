# Omix Community

## Style Guidelines

## Brand & Style

The design system is engineered for high-velocity developer collaboration, merging the real-time intimacy of chat with the structured permanence of forum-based threading. The brand personality is **technical, precise, and hyper-efficient**, evoking the feeling of a sophisticated command center rather than a social network.

The aesthetic follows a **Modern-Technical** approach with subtle **Glassmorphic** influences. It utilizes deep, low-light backgrounds to reduce eye strain during long coding sessions, accented by vibrant, neon-adjacent interactives that signal state and priority. Layouts prioritize data density and logic over decorative elements, ensuring that the interface recedes to let the conversation and code take center stage.

## Layout & Spacing

The layout utilizes a **fluid multi-pane grid** for desktop and a **stacked single-column** model for mobile.

- **Desktop:** A three-pane architecture (Navigation / Content / Utility) using fixed-width sidebars (280px) and a flexible center chat area. 
- **Mobile:** Prioritizes one-handed use with a 16px safe-area margin. The "Navigation" and "Member List" are tucked into off-canvas drawers triggered by bottom-bar icons.
- **Rhythm:** An 8px base grid governs all spatial relationships. Compact vertical density is preferred in the chat stream to allow more messages to be visible at once.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering** and **Glassmorphism**, rather than heavy shadows.
- **Level 0 (Deep):** `#0f172a` used for the workspace switcher and background.
- **Level 1 (Surface):** `#1e293b` for the primary chat window and navigation menus.
- **Level 2 (Overlay):** Popovers and modals use a semi-transparent version of the surface color with a `20px` backdrop blur and a `1px` border of `white/10%` to simulate frosted glass.
- **Borders:** Use subtle high-precision strokes (`1px`) for section dividers to maintain a structured, "engineered" look without adding bulk.

## Components

- **Buttons:** Primary buttons use a solid Electric Violet fill. Secondary buttons use a "Ghost" style with a Cyber Teal border and no fill.
- **Chat Bubbles:** Unlike consumer apps, chat bubbles are minimally styled. They feature a left-aligned border accent for "Your" messages and a subtle background tint for "System" messages. No heavy rounding or "tails."
- **Code Blocks:** Encased in a container with a `#000000/30%` background, featuring syntax highlighting using the Secondary and Tertiary colors. Include a "Copy" utility in the top-right corner.
- **Channel Lists:** Use active state indicators involving a vertical 2px bar on the left edge and a subtle text color shift to White.
- **Inputs:** Dark-filled with a 1px border that glows (box-shadow) Electric Violet upon focus.
- **Integrated Boardroom:** A specialized card component for "Updates" that uses a subtle gradient header to distinguish high-priority announcement threads from regular chat.

---
name: Omix Community
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#4fdbc8'
  on-secondary: '#003731'
  secondary-container: '#04b4a2'
  on-secondary-container: '#003f38'
  tertiary: '#ffafd3'
  on-tertiary: '#620040'
  tertiary-container: '#e364a7'
  on-tertiary-container: '#560038'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffd8e7'
  tertiary-fixed-dim: '#ffafd3'
  on-tertiary-fixed: '#3d0026'
  on-tertiary-fixed-variant: '#85145a'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  sidebar_width: 280px
---

## Brand & Style

The design system is engineered for high-velocity developer collaboration, merging the real-time intimacy of chat with the structured permanence of forum-based threading. The brand personality is **technical, precise, and hyper-efficient**, evoking the feeling of a sophisticated command center rather than a social network.

The aesthetic follows a **Modern-Technical** approach with subtle **Glassmorphic** influences. It utilizes deep, low-light backgrounds to reduce eye strain during long coding sessions, accented by vibrant, neon-adjacent interactives that signal state and priority. Layouts prioritize data density and logic over decorative elements, ensuring that the interface recedes to let the conversation and code take center stage.

## Colors

The palette is built on a "Developer Dark" foundation. 
- **Primary (Electric Violet):** Used for primary actions, active states, and brand-critical highlights.
- **Secondary (Cyber Teal):** Reserved for success states, code syntax highlighting, and secondary utility triggers.
- **Background Tiers:** The system uses `#0f172a` for the base "underlay" (sidebars, backdrops) and `#1e293b` for the main content "surface" (chat containers, cards).
- **Accents:** High-vibrancy tokens are used sparingly against dark surfaces to maintain high contrast (WCAG AA+) and provide clear visual affordance.

## Typography

This design system employs a dual-font strategy:
1. **Hanken Grotesk** for headings to provide a sharp, contemporary tech feel.
2. **Inter** for body text to maximize legibility in dense chat streams.
3. **JetBrains Mono** for metadata, labels, and code snippets, reinforcing the developer-centric nature of the platform.

For mobile devices, `display-lg` should scale down to `32px` to ensure titles fit within narrow viewports without excessive wrapping. All code blocks must use the monospaced font with a slightly reduced font size for maximum character-per-line efficiency.

## Layout & Spacing

The layout utilizes a **fluid multi-pane grid** for desktop and a **stacked single-column** model for mobile.

- **Desktop:** A three-pane architecture (Navigation / Content / Utility) using fixed-width sidebars (280px) and a flexible center chat area. 
- **Mobile:** Prioritizes one-handed use with a 16px safe-area margin. The "Navigation" and "Member List" are tucked into off-canvas drawers triggered by bottom-bar icons.
- **Rhythm:** An 8px base grid governs all spatial relationships. Compact vertical density is preferred in the chat stream to allow more messages to be visible at once.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering** and **Glassmorphism**, rather than heavy shadows.
- **Level 0 (Deep):** `#0f172a` used for the workspace switcher and background.
- **Level 1 (Surface):** `#1e293b` for the primary chat window and navigation menus.
- **Level 2 (Overlay):** Popovers and modals use a semi-transparent version of the surface color with a `20px` backdrop blur and a `1px` border of `white/10%` to simulate frosted glass.
- **Borders:** Use subtle high-precision strokes (`1px`) for section dividers to maintain a structured, "engineered" look without adding bulk.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness logic to maintain a professional, "tool-like" appearance.
- **Buttons and Inputs:** 4px (`rounded`) radius.
- **Cards and Modals:** 8px (`rounded-lg`) radius.
- **Avatars:** Strictly circular to contrast against the predominantly angular UI.
- **Status Indicators:** Small 8px circles with a 2px outer glow (bloom) in the primary or secondary accent colors to indicate active presence or new notifications.

## Components

- **Buttons:** Primary buttons use a solid Electric Violet fill. Secondary buttons use a "Ghost" style with a Cyber Teal border and no fill.
- **Chat Bubbles:** Unlike consumer apps, chat bubbles are minimally styled. They feature a left-aligned border accent for "Your" messages and a subtle background tint for "System" messages. No heavy rounding or "tails."
- **Code Blocks:** Encased in a container with a `#000000/30%` background, featuring syntax highlighting using the Secondary and Tertiary colors. Include a "Copy" utility in the top-right corner.
- **Channel Lists:** Use active state indicators involving a vertical 2px bar on the left edge and a subtle text color shift to White.
- **Inputs:** Dark-filled with a 1px border that glows (box-shadow) Electric Violet upon focus.
- **Integrated Boardroom:** A specialized card component for "Updates" that uses a subtle gradient header to distinguish high-priority announcement threads from regular chat.
