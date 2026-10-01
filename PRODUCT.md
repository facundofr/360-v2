# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: vendedores, on their phones.** Cober360 is installed as a PWA and used in the field. Vendedores work their assigned prospectos (mostly arriving via WhatsApp and the public lead form), chat with them, send cotizaciones, load pólizas, and send them for electronic signature. They work between conversations, often one-handed, with intermittent attention.
- **Secondary: supervisores, backoffice, and admin.** They oversee teams and metrics, review and process pólizas, manage prospect distribution (including refritos and automatic reassignment), prices, promotions, prestadores, and users. Assumed mostly desktop; not confirmed.

## Product Purpose

Internal sales and affiliation management system for Cober, a prepaga de salud selling its own health plans. It takes a prospect from first contact to a signed póliza: lead capture, assignment to a vendedor, WhatsApp conversation, cotización, póliza data entry, document upload, electronic signature, and backoffice processing. Success means vendedores close more affiliations with less friction, and supervisors and backoffice can see and act on the pipeline.

## Positioning

A purpose-built tool for Cober's own affiliation pipeline, not a generic CRM: it knows Cober's plans, prices, promotions, the Ley 19.032 flow, monotributo cases, VaFirma signature states, and the vendedor → supervisor → backoffice hierarchy.

## Operating Context

- Served as a PWA under `/afiliaciones/` (iOS and Android installable; push notifications via Firebase).
- Roles and routes: `vendedor` (`/prospectos`, `/prospectos-dashboard`), `supervisor` (`/supervisor*`), `backoffice` (`/backoffice*`), `admin` (`/admin*`); public `/formulario-lead`; auth flows (login, register, reset, verify email).
- WhatsApp is the main channel with prospectos; conversations live inside the app.
- Electronic signature through VaFirma with states: not sent, pendiente, firmada, rechazada, expirada.
- Refritos: recycled old prospectos redistributed among vendedores and reassigned when not contacted.
- Session management, heartbeat, and active-user monitoring are in place.

## Capabilities and Constraints

- Stack: React 19 + Vite, with a mix of MUI, Bootstrap/react-bootstrap, styled-components, and Sass; several chart libraries (MUI X Charts, Chart.js, ECharts, Recharts) and Leaflet maps.
- UI language: Spanish (Argentina). Domain terms to keep as-is: prospecto, cotización, póliza, vendedor, supervisor, backoffice, refritos, prestadores, monotributo, afiliado, obra social.
- Mobile is the primary context for the vendedor surfaces; supervisor/backoffice/admin surfaces must remain usable on desktop.
- Undecided: the device mix for supervisor, backoffice, and admin.

## Brand Commitments

- Keep Cober's colors and logo. The official brand color is plum `#7b3092` (confirmed 2026-09-30); it replaces the earlier `#8B7EC8` violet everywhere, including the PWA theme and tile color.
- Logo assets: `frontend/src/assets/img/logo.png`, `frontend/src/assets/img/logo-cober-white.svg`; PWA icons under `frontend/public` (served at `/afiliaciones/icons/`).
- Product name as displayed: "COBER 360" / "Cober360".

## Evidence on Hand

- Internal docs describing flows: `docs/` (firma electrónica, refritos, WhatsApp files, PWA setup) and `backend/VAFIRMA_*.md`.
- No testimonials, customer metrics, or marketing claims exist; do not fabricate any.

## Product Principles

1. The vendedor on a phone comes first: every step from prospecto to firmada should be doable quickly on mobile.
2. Pipeline state must be obvious at a glance (prospecto status, cotización sent, firma state), because users act on it constantly.
3. Speed of repetitive work beats decoration: this is a daily operating tool.
4. Supervisors and backoffice need trustworthy, scannable oversight rather than more dashboards.
5. Cober's identity is kept; improvements refine it rather than replace it.
