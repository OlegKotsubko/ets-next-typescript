# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state of the repository

This is a **monolith consolidation** of three legacy projects into one Next.js + Postgres app (see [Legacy provenance](#legacy-provenance)):

- **`esports-titles-system-react`** (Django/DRF) — the direct ancestor of rundowns/overlays/displays/SSE/MIDI.
- **`ets-react-poc`** (React 18) — the **etalon**: authoritative for features, routes, and data shapes.
- **`react-backoffice`** (React 16) — the CRUD admin for the shared weplay entity microservices, **absorbed into the monolith as local `project_id`-scoped tables**.

A **P0–P5a scaffold exists** (auth, entity CRUD, rundowns/items, the broadcast bus, `/preview` + `/air`), but it was built against an **earlier, partly-invented model** (UUID "projects" created in a UI, overlay-package folders, roster-image player fields). The **`docs/` have been corrected to the real system** (the etalon); the code still reflects the old model. When in doubt, `docs/` is the target of record and the etalon is the authority — **reconciling the built code to the corrected docs is pending work**. Start at `docs/README.md`.

## What ETS is

ETS ("Esports Titles System") serves broadcast graphics (lower-thirds, scoreboards, player cards, sponsor bugs, timers, brackets) to OBS/vMix. An operator **enters a tournament**, builds a **rundown of overlays**, and drives them live; the rundown's `/preview/[rundownUuid]` and `/air/[rundownUuid]` page renders a transparent 1920×1080 canvas fed by Server-Sent Events.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000. `predev` runs `titles:generate` first. |
| `npm run build` | Production build. `prebuild` runs `titles:generate` first. |
| `npm run titles:generate` | Scan the overlay tree → emit the static-import registry (codegen, not a runtime glob — see `docs/titles-system.md`). |
| `npm run db:generate` | Diff `db/schema.ts` vs `db/migrations/` → emit a new SQL migration. |
| `npm run db:migrate` | Apply pending migrations to `$DATABASE_URL`. **Never inside `next build`.** |
| `npm run db:studio` | Open Drizzle Studio. |
| `npx tsx scripts/create-user.ts <username> <password>` | Bootstrap a user (no public sign-up). |

There is no `packages:generate`, `assets:sync`, or `projects:sync` — overlays are global (not per-tournament packages), and entity data is in Postgres.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · better-auth (**username** + password, session cookie) · Zod · React Hook Form (`zodResolver`) · Drizzle ORM + Neon Postgres (`@neondatabase/serverless` HTTP driver) · MUI (admin) · SCSS + **GSAP** (overlays) · Redux Toolkit + RTK Query · deployed as a **single always-on Node server (Hetzner + Caddy)** — not serverless, so the in-process bus works. Full rationale: `docs/tech-stack.md`.

## Architecture: the load-bearing decisions

1. **Projects are tournaments; overlays are global.** A "project" **is a tournament** (a `projects` row absorbed from the tournament service) the operator browses/favourites/enters — there is **no** Add-Project flow, `project_mode`, `project_label`, or overlay-package folder. Overlay components are **global**, organized by **discipline (category) / template (widget)**; a tournament's `discipline` selects which overlays apply. See `docs/projects-system.md`.

2. **`project_id` FK isolation, enforced by URL routing.** Every entity table has a `project_id` column referencing the tournament; every entity route lives under `/api/projects/[projectId]/...` and the server derives `projectId` **from the URL, never the body**. RTK Query tags always include the project id. The real system keys everything by **integer ids** (the **rundown** also has a public `uuid` for its broadcast address). Read `docs/database.md` "Multi-tenancy" before adding an entity.

3. **Each overlay declares a widget schema (`model.ts`); the registry composes the rest.** An overlay is `index.tsx` (render, `data` prop only) + `model.ts` (Zod → the operator-editable **widget schema**: `input_type`, `choices`, `default`, `required`, `can_live_update`) + `settings.ts` (presentation: `model` key, `preview` image map, `color`, `is_fullscreen`, mixers) + `animationIn.ts`/`animationOut.ts` (GSAP). The `model.ts` schema drives (a) the admin form and (b) server-side validation of `data.widget` — **not** the SSE payload (that is assembled server-side and pushed as-is). The registry (build-time codegen) composes `{ Component, model, actions, settings }`. Shared field/action contracts live in `models/<Type>.ts`; declared thread-widget actions are the `/command`-style allow-list (`isDeclaredAction()`). See `docs/titles-system.md`.

4. **Overlay config is JSONB, validated at the API boundary — never its own table.** `rundown_overlay_data.data.widget` holds each overlay instance's operator-edited fields, validated against the overlay's `model.ts` at the API boundary. Adding/editing an overlay needs **no migration**; adding a CRUD entity or column does.

5. **SSE over an in-process event bus; the rundown is the broadcast unit.** The controller publishes `air`/`preview`/`hide`/`hide_all`/`live_update` events to an in-memory pub/sub keyed by `(rundownUuid, channel)` (`channel ∈ preview|air`); on-air state is transient and never persisted, with a per-key snapshot for reconnect replay. A renderer draws a **set** of overlays, sorted by `layer` (1–7), filtered by `display_filter` against the page's `?filter=N` (one rundown → many filtered browser sources). There is **no display entity** — the monolith dropped the etalon's `displays`/`settings` tables. See `docs/preview-air.md`, `docs/rundowns.md`.

6. **Node runtime for the SSE route (not Edge).** The stream route runs on Node so it shares the in-process bus with the Node publisher routes — an Edge SSE route can't see a Node `publish()` (separate bundles/module state), which breaks the bus even in `next dev`. On an always-on server (the deploy target) the stream stays open indefinitely; on serverless the ~10s cap would force reconnects (softened by the client holding its set across EventSource reconnects). See `docs/preview-air.md` "Caveat: the Edge/Node runtime split".

7. **Split UI: MUI for admin, SCSS + GSAP for overlays.** Overlays use `.module.scss` + CSS variables only (no MUI, no inline hex). Colors/fonts come from the **active tournament theme**, written to `:root` at runtime (`docs/projects-system.md` theming) — re-skinning is a theme change, not a code edit. Overlays animate with GSAP and composite video stinger mixers. `font-display: block` in broadcast.

## Route map

- `/login` (public) — username + password. Guest users (`is_guest && rundown`) land on their rundown's `/controller`.
- `/projects` (tournament gallery), `/projects/[projectId]/{data,rundowns,rundowns/[rundownId],rundowns/[rundownId]/controller,midi,bluetooth}` (protected via `proxy.ts`, gating `/projects/*` and `/api/projects/*`). Workspace nav: **Data**, **Overlays**, **MIDI**, **Bluetooth**.
- `/preview/[rundownUuid]`, `/air/[rundownUuid]` (**public** — OBS/vMix browser sources; rundown UUIDs are unguessable share-link tokens; `?filter=N` routes by `display_filter`). Transparent canvas; SSE-driven set of overlays.
- `/api/projects/[projectId]/...` (protected REST; broadcast publishers under `…/rundowns/[id]/broadcast/…`) · `GET /api/broadcast/[rundownUuid]/stream?channel=preview|air` (public SSE, **Node**).
- **Route groups:** admin pages under `app/(admin)/` (MUI + Redux); `/preview`, `/air` under `app/(broadcast)/` with a transparent, MUI-free root layout (OBS needs a genuinely transparent canvas; `CssBaseline` would paint `<body>`).

## State management

RTK Query = server cache (one slice per entity; tags scoped by tournament). Redux slices = ephemeral UI state and the **live composition** (`airsSlice`/`previewsSlice`: SSE-stream reducers keyed by overlay id). Never store server data in a slice; never `fetch` from a component. See `docs/state-management.md`.

## Migrations vs. entity data vs. overlays

- `db:migrate` = schema/DDL changes. Workflow: edit `db/schema.ts` → `db:generate` → commit SQL → `db:migrate` (dev then prod).
- **Entity data** (players/teams/…) = row inserts via the API. No migration.
- **Adding/editing an overlay** = code + `data.widget` JSONB. No migration.

## Single-server pub/sub caveat

The bus lives in process memory; it only works when publisher and subscriber share one process (`next dev`, a single always-on server). Multi-instance/serverless needs a cross-instance broker (Redis pub/sub, Postgres `LISTEN/NOTIFY`) — out of MVP scope. See the Edge/Node split note in decision 6.

## Roadmap

MIDI control surfaces, Bluetooth heart-rate, the WebSocket timer, MRI (Marvel Rivals) proxy streams, ATEM camera switching (seating) — all real in the etalon, staged for a later pass. Deferred entirely: scheduled/timed transitions, multi-channel rundowns, roles, audit log, bracket auto-progression. See `docs/roadmap.md`.

## Legacy provenance

Rundowns/overlays/displays/SSE/MIDI ← `esports-titles-system-react` (Django). UI/routes/controller/renderer/data-shapes ← `ets-react-poc` (React, the etalon). Entity CRUD services (tournaments/players/teams/sponsors/brackets), now local tables ← `react-backoffice`.
