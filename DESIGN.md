---
name: Cober360
description: Pocket sales office for Cober's vendedores, from prospecto to póliza firmada.
colors:
  primary: "#7b3092"
  primary-hover: "#69297c"
  primary-active: "#562266"
  primary-soft: "#f2eaf4"
  primary-tint: "#f8f5fa"
  corporate-ink: "#2D3047"
  corporate-ink-light: "#3a405a"
  teal: "#048A81"
  teal-deep: "#065f56"
  coral: "#E07A5F"
  success: "#48BB78"
  success-deep: "#38A169"
  warning: "#ED8936"
  warning-deep: "#DD6B20"
  danger: "#E53E3E"
  danger-deep: "#C53030"
  success-strong: "#2F855A"
  warning-strong: "#C05621"
  info-strong: "#7A7190"
  info: "#9B95B3"
  canvas: "#fafbfc"
  surface: "#ffffff"
  surface-muted: "#f4f6f8"
  hairline: "#e8ecf0"
  hairline-strong: "#d1d7dd"
  placeholder: "#b3bcc7"
  text-muted: "#8492a6"
  text-secondary: "#5a6a7a"
  text-heading: "#3e4954"
  text-primary: "#2a3039"
typography:
  headline:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.01em"
  body-control:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.5px"
  badge:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  2xl: "32px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.surface}"
  button-corporate:
    backgroundColor: "{colors.corporate-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-corporate-hover:
    backgroundColor: "{colors.corporate-ink-light}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-outline-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-control}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  card-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.corporate-ink}"
    typography: "{typography.title}"
    padding: "28px"
  badge:
    typography: "{typography.badge}"
    rounded: "{rounded.md}"
    padding: "0.5em 0.875em"
  nav-item:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
---

# Design System: Cober360

## Overview

**Creative North Star: "The Pocket Office"**

Cober360 is the office a vendedor carries in their pocket. It is a working tool first: every screen exists to move a prospecto one step closer to a signed póliza, usually on a phone, often between WhatsApp messages. The system is light and calm (pale canvas, white surfaces, deep ink text) so that the two things that matter stand out: Cober's plum as the signature for "act here", and the status colors that say where each prospecto and póliza stands.

The form language is soft and rounded. Corners are generous (14px on controls, 24px on cards), transitions are unhurried, and depth comes from light, low-contrast shadows rather than glass, gradients, or decorative stripes. Brand lives in precise details (the plum accent on the active nav item, the focus ring, the primary action) rather than in large colored areas.

The incumbent code carries layers of past experiments (glass-morphism cards, gradient text, a four-color stripe above cards, hardcoded Bootstrap defaults in components). This document records the confirmed direction; those layers are drift to be retired, not patterns to extend.

**Key Characteristics:**
- Light, calm canvas; plum reserved for the primary action and the current selection.
- One typeface, Lato, for everything.
- Soft, rounded forms: 14px controls, 24px cards, pill badges and avatars.
- Soft, subtle shadows for depth; no glass, no gradients.
- Status colors carry meaning and are used consistently for prospecto, póliza, and firma states.

## Colors

A restrained light palette anchored by Cober's plum and a deep blue-grey ink, with a small, consistent set of status colors.

### Primary
- **Cober Plum** (#7b3092): The brand color. Primary buttons, active navigation, links, focus rings, selected states. Contrast on white is about 7.7:1, so it is safe for text and icons at any size. This is the confirmed official value; the code currently renders `purple` (#800080) from `$primary`, and the PWA manifest and `index.html` still use the retired #8B7EC8. Both must move to #7b3092.
- **Plum Pressed** (#69297c) and **Plum Deep** (#562266): Hover and active states of plum surfaces.
- **Plum Mist** (#f2eaf4) and **Plum Whisper** (#f8f5fa): Backgrounds for the active nav item, selected rows, and subtle hover on plum-accented controls.

### Secondary
- **Corporate Ink** (#2D3047): Cober's deep blue-grey. Headings, the corporate button, the PWA splash background, and any dark surface. **Corporate Ink Light** (#3a405a) is its hover.

### Tertiary
- **Deep Teal** (#048A81): Secondary actions and positive, non-status emphasis. **Teal Deep** (#065f56) for hover/active.
- **Warm Coral** (#E07A5F): Occasional accent (accent button). Use sparingly; it is not a status color.

### Status
- **Success Green** (#48BB78): Póliza activa, firma completada, approved.
- **Warning Orange** (#ED8936): Pendiente (póliza pendiente, firma pendiente).
- **Danger Red** (#E53E3E): Cancelada, rechazada, errors, destructive actions.
- **Dusty Lavender** (#9B95B3): Informational and temporary states.
- **Muted Grey** (#8492a6): Vencida, expirada, inactive.

### Neutral
- **Canvas** (#fafbfc): App background.
- **Surface** (#ffffff): Cards, inputs, modals, nav.
- **Surface Muted** (#f4f6f8): Secondary panels and table stripes.
- **Hairline** (#e8ecf0) and **Hairline Strong** (#d1d7dd): Borders, dividers, input strokes.
- **Placeholder** (#b3bcc7), **Text Muted** (#8492a6), **Text Secondary** (#5a6a7a), **Text Heading** (#3e4954), **Text Primary** (#2a3039): Text hierarchy from quietest to strongest.

### Named Rules
**The Plum Means Act Rule.** Plum marks the primary action and the current selection on a screen, and little else. If everything is plum, nothing is.

**The One Status Language Rule.** A state has one color everywhere: pendiente is always orange, firmada/activa always green, rechazada/cancelada always red, expirada/vencida always grey. Never use Bootstrap defaults (#dc3545, #28a745, #ffc107, #0d6efd) for these.

## Typography

**Body Font:** Lato (with -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif)

**Character:** A single humanist sans throughout. Lato is warm enough for a health brand and clear at small sizes on a phone. Weight and size carry the hierarchy; no second family is needed. (Inter is declared in some CSS variables but is overridden by the global Lato rule and does not render.)

### Hierarchy
- **Headline** (700, 1.5rem, 1.2, -0.025em): Page and topbar titles.
- **Title** (700, 1.25rem, 1.2, -0.025em): Card headers, sidebar title, modal titles.
- **Body** (400, 1rem, 1.6, 0.01em): Default text.
- **Body Control** (400, 0.95rem): Text inside inputs and selects.
- **Label** (600, 0.9rem, 0.5px, uppercase): Form labels.
- **Badge** (600, 0.8rem, 0.025em, uppercase): Status badges.

Buttons use 600 weight with 0.025em tracking, sentence case.

### Named Rules
**The One Family Rule.** Everything is Lato. Hierarchy comes from weight (400 / 600 / 700) and size, never from a second typeface.

## Layout

Bootstrap 5 grid with its standard breakpoints (576, 768, 992, 1200, 1400px) plus a dedicated tuning for 1366×768 laptops. Gutters are 1.5rem by default.

- **Phone (below 768px):** the primary context. Navigation collapses into an offcanvas sidebar opened from the topbar menu toggle; content stacks to one column; dashboard metrics become compact mobile cards.
- **Tablet and desktop:** persistent left sidebar per role (vendedor, supervisor, admin) with a sticky topbar (white, hairline bottom border).

Spacing follows a 4/8/16/24px rhythm, with roomier internal padding in the soft style: controls 14px × 20–28px, nav items 16px × 20px, card headers 28px.

## Elevation & Depth

Depth is soft and subtle: white surfaces lift gently off the pale canvas with low-opacity shadows, and overlays (dropdowns, modals, offcanvas) get the stronger ones. No glass, no blur, no gradient fills.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): Topbar, plain cards, list items.
- **Card** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): Default cards.
- **Hover / Raised** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Button hover, dropdowns.
- **Overlay** (`box-shadow: 0 20px 25px -5px rgba(45, 48, 71, 0.1), 0 8px 10px -6px rgba(45, 48, 71, 0.1)`): Modals and offcanvas.
- **Plum Focus** (`box-shadow: 0 0 0 0.2rem rgba(123, 48, 146, 0.25)`): Focus ring for plum controls and inputs.

### Named Rules
**The Soft Lift Rule.** Shadows stay low-opacity and neutral. Depth is a hint, never a special effect.

## Shapes

Soft and rounded. Controls (buttons, inputs, nav items, badges) use 14px corners; small chips and close buttons use 10px; cards use 24px; large feature panels may use 32px; avatars and count bubbles are fully round. Borders are 1px hairlines on surfaces and 2px on inputs.

## Components

### Buttons
Soft and confident, sized for a thumb.
- **Shape:** gently rounded (14px).
- **Primary:** Cober Plum fill, white text, 14px × 28px padding, 600 weight. Hover darkens to Plum Pressed with the Hover shadow; focus shows the Plum Focus ring.
- **Corporate:** Corporate Ink fill for strong neutral actions.
- **Secondary:** Deep Teal fill for secondary positive actions.
- **Outline Primary:** white fill, plum border and text; fills plum on hover.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** Surface white on Canvas.
- **Shadow Strategy:** Card shadow at rest; Rest shadow plus a 1px hairline for flat variants.
- **Header:** Canvas background, hairline bottom border, Title typography in Corporate Ink, 28px padding.
- **Decoration:** none. The four-color top stripe is retired.

### Inputs / Fields
- **Style:** white fill, 2px Hairline stroke, 14px corners, 14px × 20px padding.
- **Focus:** stroke turns Cober Plum with the Plum Focus ring. No movement on focus.
- **Label:** Label typography above the field in Corporate Ink.
- **Placeholder:** Placeholder grey.

### Status Badges
- **Style:** filled with the status color's strong variant (Success Strong #2F855A, Warning Strong #C05621, Danger Deep #C53030, Info Strong #7A7190, Text Secondary #5a6a7a) so white text keeps ≥4.5:1; 14px corners, Badge typography.
- **Firma states (VaFirma):** pendiente = Warning Orange, firmada = Success Green, rechazada = Danger Red, expirada = Muted Grey.
- **Póliza states:** activa = Success, pendiente = Warning, cancelada = Danger, temporal = Dusty Lavender, vencida = Muted Grey.
- **Outline variant:** white fill, status-colored border and text; preferred where text contrast matters.

### Navigation
- **Sidebar (per role):** white surface, hairline right border. Nav items are 14px-rounded rows in Text Secondary with grey icons; hover tints to Plum Whisper with plum text; the active item uses Plum Mist background, plum text and icon, and a 4px plum bar on its left edge.
- **Topbar:** sticky, white, hairline bottom border, Rest shadow; holds the menu toggle (phone) and the Headline title.
- **Phone:** the sidebar becomes an offcanvas drawer opened from the topbar toggle.

## Do's and Don'ts

### Do:
- **Do** use Cober Plum (#7b3092) for the single primary action on a screen and for the current selection.
- **Do** use the status colors consistently for prospecto, póliza, and firma states across every role's screens.
- **Do** keep controls at 14px corners and cards at 24px.
- **Do** keep depth to the soft shadow vocabulary above.
- **Do** reference the shared tokens (SCSS variables / CSS custom properties) instead of hardcoding hex values in JSX.

### Don't:
- **Don't** use the retired #8B7EC8 violet or CSS `purple` (#800080); both are replaced by #7b3092, including in the PWA manifest and theme-color meta tags.
- **Don't** add the red/orange/teal/navy four-color stripe (#D0142B, #FFA200, #12BBC6, #003558) above cards; it carries no brand meaning.
- **Don't** use glass-morphism (backdrop-filter blur), gradient fills, or gradient text.
- **Don't** use Bootstrap default colors (#dc3545, #28a745, #ffc107, #0d6efd, #6c757d) or SweetAlert's default blue (#3085d6) in components.
- **Don't** put small white text on Success Green or Warning Orange (about 2.5:1 contrast); use the outline badge or the deep variant.
- **Don't** introduce a second typeface.
