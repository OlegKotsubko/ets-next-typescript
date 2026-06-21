# Base App — Scope & Decomposition

**Date:** 2026-06-18
**Purpose:** Break the ETS base app (everything the Multi-User MIDI Remote plan
lists as Prerequisites) into dependency-ordered sub-plans. Each sub-plan is its
own spec→plan→implement cycle and ends with working, testable software.

**Source of truth:** the existing `docs/` already specify all of this in detail.
This document only sequences it and marks the minimal cut that unblocks the MIDI
feature.

## Why decompose

The base app spans auth, database, title rendering, the broadcast bus, SSE
pages, and admin CRUD — independent subsystems with a clear build order. One
50-task plan would be unreviewable and would couple unrelated work. Each piece
below can be built, tested, and committed before the next begins.

## What the MIDI feature actually needs

From `2026-06-18-multi-user-midi-remote.md` Prerequisites: `@/db` + schema
(`users`, `projects`, `rundowns`, `rundownItems`), `@/lib/auth` + `getSession`,
`@/lib/broadcast/bus.publish`, `@/lib/titles/registry.getTitleModel`,
`middleware.ts`, a configured RTK store, and `rundownItems.label`. To *validate*
MIDI end-to-end you also need to create a rundown + title and watch `/air`
react. That maps to sub-plans **P0–P5**. **P6 (Data CRUD) and P7 (deploy) are
NOT required** for the MIDI feature.

## Sub-plan sequence

### P0 — Project scaffold & tooling
**Delivers:** a booting Next.js 15 app you can `npm run dev` and `npm test`.
- Next.js 15 App Router + React 19 + TS; `package.json` with the full pinned
  stack from `docs/tech-stack.md`; `tsconfig.json` path alias `@/*`; ESLint.
- `git init`; Vitest config (the MIDI plan's Task 1 moves here); `.env.example`.
- RTK store skeleton (`store/index.ts`, provider) and MUI theme provider.
- SCSS pipeline enabled (`sass` installed; a sample `.module.scss` compiles).
**Test:** app renders `/`; `npm test` green.
**Blocks:** everything.

### P1 — Database & schema
**Delivers:** migratable, seeded Postgres via Drizzle.
- `db/index.ts` (Neon HTTP driver); `db/schema.ts` with `users` (better-auth
  tables come in P2 — coordinate the adapter), `projects`, `rundowns`
  (incl. `owner_id`), `rundown_items` (incl. `label`, `data jsonb`);
  `drizzle.config.ts`; `db:generate`/`db:migrate`/`db:studio` scripts.
- Seed migration inserting the singleton project (`SEED_PROJECT_ID`).
**Test:** migrate + seed succeeds; schema-shape tests; a round-trip insert/select.
**Depends on:** P0. **Note:** the MIDI plan's Task 2 schema additions can fold
in here OR stay in the feature plan — recommend keeping the 3 collaboration
tables in the feature plan, only `rundowns.owner_id` + `rundown_items.label`
land here.

### P2 — Auth
**Delivers:** login, sessions, protected routes.
- `lib/auth.ts` (better-auth + Drizzle adapter), `lib/auth-client.ts`,
  `app/api/auth/[...all]/route.ts`, `/login` page (**React Hook Form +
  `zodResolver`**), `middleware.ts` gating `/admin/*` and `/api/*`,
  `scripts/create-user.ts`.
**Test:** create-user works; login sets session; protected route redirects when
logged out; session readable server-side.
**Depends on:** P0, P1.

### P3 — Title system
**Delivers:** the overlay-package + title contract and a working example title.
- `lib/titles/registry.ts` (scan `projects/<label>/titles/*`), the three-file
  title contract (`index.tsx`, `model.ts`, `settings.ts`), `getTitleModel`.
- One example overlay package `projects/default/` with one title (e.g.
  `lower-third`) styled in **SCSS** consuming `project.css` CSS vars;
  `assets:sync` script (`projects/*` → `public/projects/*`).
- Dev-only `app/_dev/title-preview/page.tsx`.
**Test:** registry resolves the example title; `getTitleModel('lower-third')`
parses valid data and rejects invalid.
**Depends on:** P0.

### P4 — Broadcast bus + SSE + preview/air
**Delivers:** publishing an event visibly shows/hides a title on `/air`.
- `lib/broadcast/bus.ts` (in-process pub/sub keyed by `rundownId`,
  `publish`/`subscribe`); SSE Edge route
  `app/api/broadcast/[rundownId]/stream/route.ts` (`runtime = 'edge'`);
  `/preview/[rundownId]` and `/air/[rundownId]` pages rendering the title from
  the SSE `data` prop (no Redux).
**Test:** bus unit tests (publish→subscriber receives); an integration check that
a published `show` event renders the title on `/air`.
**Depends on:** P0, P3.

### P5 — Admin workspace: rundowns & controller
**Delivers:** an operator can build a rundown and drive `/air` from `/admin`.
- `/admin` lands on the singleton project workspace (no gallery, no Add Project);
  nav = Data / Overlays. Overlays = rundown list + rundown CRUD
  (`/api/projects/[projectId]/rundowns`), each rundown sets `owner_id = me`.
- Rundown-items (titles) CRUD: add a title, edit its `data` via a **React Hook
  Form** generated from the title's `model.ts`; the controller fires
  show/hide/update to the bus (admin AIR/HIDE).
**Test:** create rundown → add title → click AIR → `/air` shows it (the same path
MIDI will later trigger).
**Depends on:** P1, P2, P3, P4. **← MIDI feature unblocked after this.**

---

### P6 — Data CRUD *(optional, not needed for MIDI)*
Players / teams / sponsors / assets / videos / brackets / project_css, each the
documented `project_id`-scoped entity with RTK slice + RHF form. Per
`docs/data-entities.md`.

### P7 — Deployment *(optional, not needed for MIDI)*
Netlify + `@netlify/plugin-nextjs`, Neon branching for dev/prod, env wiring,
migration workflow in CI. Per `docs/deployment.md`.

## Chosen path (decided 2026-06-18)

Build the **full MVP base, P0 → P7**, then run the **Multi-User MIDI Remote**
plan. Plans are written **one at a time**: write P0 → execute → write P1 → …, so
each plan reflects what the previous one actually produced.

- **Build order:** P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → MIDI feature.
- **First plan:** `docs/superpowers/plans/2026-06-18-p0-scaffold.md`.
- **Schema split (still applies):** P1 lands `rundowns.owner_id` +
  `rundown_items.label`; the 3 collaboration tables stay in the MIDI feature
  plan.
