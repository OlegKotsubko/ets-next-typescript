# Tech Stack

## Versions

Pinned in `package.json`. The versions below are minimums known to work; bump deliberately.

| Concern | Package | Version |
|---|---|---|
| Framework | `next` | `^16.0.0` |
| UI runtime | `react`, `react-dom` | `^19.0.0` |
| TypeScript | `typescript` | `^5.6.0` |
| Auth | `better-auth` | `^1.6.0` |
| Validation | `zod` | `^3.23.0` |
| Forms | `react-hook-form`, `@hookform/resolvers` | `^7.53.0`, `^3.9.0` |
| ORM | `drizzle-orm`, `drizzle-kit` | `^0.45.0`, `^0.31.0` |
| Database driver | `@neondatabase/serverless` | `^0.10.0` |
| Admin UI | `@mui/material`, `@emotion/react`, `@emotion/styled` | `^6.0.0` |
| Overlay styling | `sass` (SCSS) | `^1.80.0` |
| Overlay animation | `gsap` | `^3.11.0` |
| State / data | `@reduxjs/toolkit`, `react-redux` | `^2.3.0`, `^9.1.0` |
| Netlify adapter | `@netlify/plugin-nextjs` | `^5.0.0` |
| Asset sync / codegen | `tsx` (dev only — Node built-ins do the copying and watching, no `fs-extra`/`chokidar`) | latest |

## Why each piece

**Next.js (App Router).** One repo for frontend and backend. App Router gives Server Components for fast admin pages, Route Handlers for the JSON API, and per-route runtime selection — everything, including the SSE stream, runs on **Node** so the in-process broadcast bus is shared across routes.

**better-auth.** Username + password sign-in with sessions in the database (session cookie, no client JWT). Supports the etalon's guest-user flow. Server-side session helpers integrate cleanly with API routes and the `proxy.ts` guard.

**Zod.** The contract layer. Each overlay's `model.ts` Zod schema (its widget schema) is reused for: (1) the admin form and (2) API validation of `data.widget`. The SSE render payload is assembled server-side and is **not** re-validated against the schema. See [titles-system.md](./titles-system.md).

**React Hook Form (+ `@hookform/resolvers`).** All admin forms. Uncontrolled inputs keep re-renders minimal on the dense CRUD screens, and the `zodResolver` wires each entity's Zod schema straight into form validation — so the same schema that validates the API body also validates the form, no duplication.

**Drizzle + Neon.** Drizzle is TypeScript-first with a thin runtime — good fit for Edge later if needed. Neon's HTTP driver (`@neondatabase/serverless`) is the only Postgres client that runs in serverless functions without connection-pool exhaustion. Neon's **database branching** is the foundation of our [dev/prod environment setup](./deployment.md).

**MUI for admin.** Matches the dense, dark, professional aesthetic in the reference screenshots (cards, dialogs, dropdowns, table-heavy CRUD). Built-in dark theme, mature form components, no need to assemble shadcn primitives.

**SCSS + GSAP for overlay components.** Overlays render into OBS/vMix browser sources where every kilobyte and paint matters. SCSS compiles to plain CSS at build time — no runtime CSS-in-JS. Each overlay imports a co-located `.module.scss`; brand colors and fonts come from the **active tournament theme**, written to `:root` as CSS variables at runtime ([projects-system.md](./projects-system.md#theming)), consumed via `var(--…)`. Re-skinning is a theme change, not a code edit. Overlays animate in/out with **GSAP** timelines and composite video **stinger mixers**. **MUI is not imported inside overlays.** `font-display: block` (not `swap`) in broadcast.

**Redux Toolkit + RTK Query.** RTK Query is the server-cache layer. One slice per entity gives auto-generated hooks and tag-based invalidation. Redux slices also reduce the two SSE streams into the live composition (`airsSlice`/`previewsSlice`). See [state-management.md](./state-management.md).

**Server-Sent Events for the live composition.** One-way push, simple HTTP, works through CDNs. The stream route runs on Node so it shares the in-process bus with the Node publisher routes (the Edge/Node split otherwise breaks in-process pub/sub — see [preview-air.md](./preview-air.md#caveat-the-edgenode-runtime-split)). **WebSockets** are used for the two-way subsystems that need them — the **timer** and **heart-rate** streams.

**Netlify deployment.** Branch-based environments (Production / Deploy Preview / Branch Deploys) with per-context environment variables map naturally onto Neon's database branching. The `@netlify/plugin-nextjs` adapter routes Next.js Edge functions to Netlify Edge Functions automatically. See [deployment.md](./deployment.md).

## What we deliberately did NOT use

- **WebSockets for the composition** — the preview/air composition is one-way, so SSE carries it. WebSockets are reserved for the genuinely bidirectional timer and heart-rate subsystems.
- **Tailwind** — SCSS compiles to plain CSS with zero runtime and keeps overlay styling decoupled from a utility config.
- **shadcn/ui** — MUI already gives us themed components.
- **Prisma** — Drizzle is a better fit for the serverless driver.
- **next-auth / Auth.js** — better-auth is simpler and supports the username + guest-user model.
- **GraphQL** — REST under `/api/projects/[projectId]/...` is plenty for CRUD.

## Install once

```bash
npm install next@^16 react@^19 react-dom@^19 typescript@^5.6
npm install better-auth zod
npm install react-hook-form @hookform/resolvers
npm install drizzle-orm @neondatabase/serverless
npm install --save-dev drizzle-kit
npm install @mui/material @emotion/react @emotion/styled
npm install --save-dev sass
npm install gsap
npm install @reduxjs/toolkit react-redux
npm install --save-dev @netlify/plugin-nextjs tsx
```
