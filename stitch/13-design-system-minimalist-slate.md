# Minimalist Slate

## Style Guidelines

## Brand & Style
The **Minimalist Slate** variation is a refined, focused design system built for productivity and calm community management. It utilizes a **Modern Minimalist** approach with a "Light-Dark" palette—avoiding pure blacks in favor of deep, breathable grays.

The emotional response is one of clarity and professional trust. It features generous whitespace and subtle transitions, ensuring the content remains the primary focus.

## Layout & Spacing
This system follows a **Fluid Content** model with an emphasis on whitespace. 

- **Breathing Room:** Increase standard margins by 1.5x compared to typical layouts. 
- **Alignment:** Center-aligned content for marketing sections; left-aligned for functional dashboards.
- **Desktop:** Max-width of 1200px to prevent lines of text from becoming too long.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Soft Shadows**.

- **Surfaces:** Use slightly lighter shades of Slate to indicate hierarchy. A card will be #1E293B against a background of #0F172A.
- **Shadows:** Very soft, large-radius shadows (24px blur, 10% opacity black) are used to lift active modals and menus. 
- No borders are used for elevation; depth is created purely through color steps.

## Components
- **Buttons:** Primary buttons use a solid Emerald fill. Secondary buttons are "Ghost" style with a Slate-300 text color and no border until hover.
- **Input Fields:** Filled style using a slightly lighter slate than the background. No border, only a 2px Emerald bottom-border on focus.
- **Cards:** No borders. Background color is one step lighter than the page background.
- **Lists:** Clean, borderless list items with generous vertical padding (16px+). 
- **Chips:** Highly rounded (pill-shaped) with low-contrast backgrounds (e.g., Emerald at 10% opacity with Emerald text).

---
name: Minimalist Slate
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
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#bcc7de'
  on-tertiary: '#263143'
  tertiary-container: '#98a3ba'
  on-tertiary-container: '#2e394c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  section-gap: 4rem
  element-gap: 1.5rem
  container-padding: 2rem
---

## Brand & Style
The **Minimalist Slate** variation is a refined, focused design system built for productivity and calm community management. It utilizes a **Modern Minimalist** approach with a "Light-Dark" palette—avoiding pure blacks in favor of deep, breathable grays.

The emotional response is one of clarity and professional trust. It features generous whitespace and subtle transitions, ensuring the content remains the primary focus.

## Colors
The palette is centered around **Slate** and **Emerald**.

- **Primary (Emerald):** A calm, natural green used sparingly for meaningful interaction and success states.
- **Secondary (Cool Gray):** Used for supporting text and non-critical icons to reduce visual noise.
- **Surface Colors:** Built on a scale of deep slates (e.g., #0F172A to #1E293B) to provide a softer contrast than pure black.

## Typography
Typography is balanced and highly legible.

- **Headlines:** **Manrope** provides a modern, slightly rounded geometric feel that adds a touch of personality without being distracting.
- **Body & Labels:** **Inter** is used for its systematic, utilitarian performance. 
- Line heights are intentionally generous (1.6x to 1.75x) to improve readability and create an "airy" feel within a dark theme.

## Layout & Spacing
This system follows a **Fluid Content** model with an emphasis on whitespace. 

- **Breathing Room:** Increase standard margins by 1.5x compared to typical layouts. 
- **Alignment:** Center-aligned content for marketing sections; left-aligned for functional dashboards.
- **Desktop:** Max-width of 1200px to prevent lines of text from becoming too long.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Soft Shadows**.

- **Surfaces:** Use slightly lighter shades of Slate to indicate hierarchy. A card will be #1E293B against a background of #0F172A.
- **Shadows:** Very soft, large-radius shadows (24px blur, 10% opacity black) are used to lift active modals and menus. 
- No borders are used for elevation; depth is created purely through color steps.

## Shapes
Shapes are **Rounded** and friendly.

- Standard UI elements (buttons, inputs) use a 0.5rem radius.
- Larger containers like cards use 1rem.
- This softness offsets the professional tone of the Slate colors, making the system feel more approachable.

## Components
- **Buttons:** Primary buttons use a solid Emerald fill. Secondary buttons are "Ghost" style with a Slate-300 text color and no border until hover.
- **Input Fields:** Filled style using a slightly lighter slate than the background. No border, only a 2px Emerald bottom-border on focus.
- **Cards:** No borders. Background color is one step lighter than the page background.
- **Lists:** Clean, borderless list items with generous vertical padding (16px+). 
- **Chips:** Highly rounded (pill-shaped) with low-contrast backgrounds (e.g., Emerald at 10% opacity with Emerald text).
