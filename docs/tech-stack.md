# Tech Stack

## Versions

Pinned in `package.json`. The versions below are minimums known to work; bump deliberately.

| Concern | Package | Version |
|---|---|---|
| Framework | `next` | `^15.0.0` |
| UI runtime | `react`, `react-dom` | `^19.0.0` |
| TypeScript | `typescript` | `^5.6.0` |
| Auth | `better-auth`, `better-auth-next` | latest stable |
| Validation | `zod` | `^3.23.0` |
| Forms | `react-hook-form`, `@hookform/resolvers` | `^7.53.0`, `^3.9.0` |
| ORM | `drizzle-orm`, `drizzle-kit` | `^0.36.0`, `^0.27.0` |
| Database driver | `@neondatabase/serverless` | `^0.10.0` |
| Admin UI | `@mui/material`, `@emotion/react`, `@emotion/styled` | `^6.0.0` |
| Title styling | `sass` (SCSS) | `^1.80.0` |
| State / data | `@reduxjs/toolkit`, `react-redux` | `^2.3.0`, `^9.1.0` |
| Netlify adapter | `@netlify/plugin-nextjs` | `^5.0.0` |
| Asset sync | `tsx`, `fs-extra`, `chokidar` (dev only) | latest |

## Why each piece

**Next.js (App Router).** One repo for frontend and backend. App Router gives per-route runtime selection (Node for most routes, **Edge** for SSE streams), Server Components for fast admin pages, and Route Handlers for the JSON API.

**better-auth-next.** Email + password sign-in with sessions in the database. Pluggable to OAuth later without rewriting the login UI. Server-side session helpers integrate cleanly with both API routes and middleware.

**Zod.** The contract layer. Each title's `model.ts` Zod schema is reused for: (1) the admin form, (2) API mutation validation, (3) SSE payload validation. One schema, three call sites. See [titles-system.md](./titles-system.md).

**React Hook Form (+ `@hookform/resolvers`).** All admin forms. Uncontrolled inputs keep re-renders minimal on the dense CRUD screens, and the `zodResolver` wires each entity's Zod schema straight into form validation — so the same schema that validates the API body also validates the form, no duplication.

**Drizzle + Neon.** Drizzle is TypeScript-first with a thin runtime — good fit for Edge later if needed. Neon's HTTP driver (`@neondatabase/serverless`) is the only Postgres client that runs in serverless functions without connection-pool exhaustion. Neon's **database branching** is the foundation of our [dev/prod environment setup](./deployment.md).

**MUI for admin.** Matches the dense, dark, professional aesthetic in the reference screenshots (cards, dialogs, dropdowns, table-heavy CRUD). Built-in dark theme, mature form components, no need to assemble shadcn primitives.

**SCSS for title components.** Title components render into OBS/vMix browser sources where every kilobyte and every paint matters. SCSS compiles to plain CSS at build time — **no runtime CSS-in-JS**, no utility-class runtime. Each title imports a co-located `.module.scss` (or `.scss`); brand colors and fonts come from each project's `project.css` (`@font-face` + `:root` CSS variables), which the SCSS consumes via `var(--…)`. Re-skinning a project is a CSS-variable edit, not a title edit. **MUI is not imported inside title components.** Use `font-display: block` (not `swap`) in broadcast contexts.

**Redux Toolkit + RTK Query.** RTK Query is the server-cache layer (replaces SWR/React Query for our use case). One API slice per entity (`playersApi`, `teamsApi`, …) gives us auto-generated hooks, optimistic updates, and tag-based cache invalidation. A thin Redux slice holds ephemeral UI state (selected title, controller HIDE/AIR state). See [state-management.md](./state-management.md).

**Server-Sent Events on Edge runtime.** One-way push, simple HTTP, works through Netlify's CDN. WebSockets would add complexity (bidirectional channel, sticky sessions on Netlify) that we don't need. Edge runtime is required because **Netlify Functions cap at 10s and SSE streams are long-lived**.

**Netlify deployment.** Branch-based environments (Production / Deploy Preview / Branch Deploys) with per-context environment variables map naturally onto Neon's database branching. The `@netlify/plugin-nextjs` adapter routes Next.js Edge functions to Netlify Edge Functions automatically. See [deployment.md](./deployment.md).

## What we deliberately did NOT use

- **WebSockets** — overkill; see SSE rationale above.
- **Tailwind** — SCSS compiles to plain CSS with zero runtime and keeps title styling decoupled from a utility config; we don't need atomic utilities for a small set of title components.
- **shadcn/ui** — MUI already gives us themed components.
- **Prisma** — Drizzle is a better fit for the serverless driver and Edge readiness.
- **next-auth / Auth.js** — better-auth-next is simpler for the email-only MVP.
- **GraphQL** — REST under `/api/projects/[projectId]/...` is plenty for CRUD.

## Install once

```bash
npm install next@^15 react@^19 react-dom@^19 typescript@^5.6
npm install better-auth better-auth-next zod
npm install react-hook-form @hookform/resolvers
npm install drizzle-orm @neondatabase/serverless
npm install --save-dev drizzle-kit
npm install @mui/material @emotion/react @emotion/styled
npm install --save-dev sass
npm install @reduxjs/toolkit react-redux
npm install --save-dev @netlify/plugin-nextjs tsx fs-extra chokidar
```
