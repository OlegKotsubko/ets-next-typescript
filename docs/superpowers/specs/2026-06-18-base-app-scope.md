# Base App — Scope & Decomposition

**Date:** 2026-06-18 · **Revised:** 2026-06-21 (rebase) · **2026-08-10** (realigned to shipped code)
**Purpose:** Break the ETS base app into dependency-ordered sub-plans. Each
sub-plan is its own spec→plan→implement cycle and ends with working, testable
software.

**Source of truth:** the existing `docs/` already specify all of this in detail.
This document only sequences it.

## Status

| Stage | State | Shipped as |
|---|---|---|
| P0 scaffold | ✅ done | Next **16** (not 15 — `proxy.ts` needs it), React 19, TS, Vitest, ESLint flat config, RTK store, MUI theme, SCSS |
| P1 database | ✅ done | `db/schema.ts` + migrations `0000`, `0001`, `0002` |
| P2 auth | ✅ done | `lib/auth.ts`, `/login`, `/admin`, `proxy.ts` guard, `scripts/create-user.ts` |
| P3 titles | ✅ done | shared `models/`, three-file title contract, build-time codegen registries (titles + packages), `default` package with two titles, `assets:sync`, `app/dev/title-preview` |
| P4 bus + SSE | ⬜ **next** | — |
| P5a admin shell | ⬜ | — |
| P5b controller | ⬜ | already planned (14 tasks) |
| P6 data CRUD · P7 deploy | ⬜ | — |

Branch `p2-auth`; 40 tests passing; `npm run build` clean. **Everything from P3
down is unbuilt.**

P2's plan had stalled after Task 4 (no `/login`, no `/admin`, no
`scripts/create-user.ts`). Tasks 5–9 were executed on 2026-08-10 and the loop is
now verified end to end against the dev Neon branch:

| Check | Result |
|---|---|
| `/admin` logged out | `307` → `/login` |
| `GET /api/projects/x` logged out | `401 {"error":"Unauthorized"}` |
| `POST /api/auth/sign-up/email` | `400` — `disableSignUp` holds |
| `/login` | `200` (public) |
| sign in → `/admin` | `200`, renders the operator email + Sign out |
| sign out → `/admin` | `307` → `/login` |
| `next build` | `ƒ Proxy (Middleware)` registered — confirms `proxy.ts` on Next 16 |

> ## Revision note (2026-06-21, amended 2026-08-10)
>
> This scope was originally written as "the minimal cut that unblocks the MIDI
> feature" and assumed a **singleton project**. That premise is **dropped as the
> end state**, with one nuance the shipped code makes concrete:
>
> 1. **Multi-project is the target, per `CLAUDE.md` and `docs/projects-system.md`.**
>    Projects are UUID rows created from the `/admin` gallery via **Add Project**,
>    each selecting an overlay package by `project_label`.
>    **However:** P1 shipped `0001_seed_singleton_project.sql`, which inserts one
>    row (`00000000-…-0001`, label `default`) idempotently. That row **stays** — it
>    is a convenient dev fixture, not a constraint. Nothing may hardcode its id;
>    every route derives `projectId` from the URL. Multi-project lands in **P5a**
>    (gallery + `POST /api/projects`), and needs **no migration** — the table
>    already supports it.
> 2. **P3/P4/P5 absorb the newer designs** —
>    [multi-layer Preview→Air](./2026-06-21-multi-layer-preview-air-design.md) and
>    [title contract & thread widgets](./2026-06-21-title-contract-and-thread-widgets-design.md).
>    Build each piece once, correctly, rather than building the single-on-air-title
>    design and retrofitting it.
> 3. **`layer` is *not* in the shipped schema.** An earlier draft of this doc said
>    to fold it into P1; that was wrong. `rundown_items` shipped without it, so it
>    stays where it was always planned — **Task 1 of the multi-layer plan**, as its
>    own migration.

## Why decompose

The base app spans auth, database, title rendering, the broadcast bus, SSE
pages, and admin CRUD — independent subsystems with a clear build order. One
50-task plan would be unreviewable and would couple unrelated work. Each piece
below can be built, tested, and committed before the next begins.

## Sub-plan sequence

### P0 — Project scaffold & tooling ✅ done
**Delivered:** a booting app with `npm run dev` / `npm test` / `npm run lint`.
- **Next.js 16** App Router + React 19 + TS; `tsconfig.json` alias `@/*`;
  ESLint **flat config via the eslint CLI** (not `next lint`).
- Vitest config; `.env.example`; RTK store + MUI theme provider; SCSS pipeline.
- `editorSlice` kept minimal (`selectedItemId`) — the multi-layer design derives
  staged/live sets from SSE, not Redux.
- **Deviation from `docs/tech-stack.md`:** that doc pins Next 15. The upgrade to
  16 was forced by `proxy.ts` (the Next 15.5 middleware rename) only registering
  on 16. `tech-stack.md` still needs updating to match.

**Plan:** `docs/superpowers/plans/2026-06-18-p0-scaffold.md` (executed).

### P1 — Database & schema ✅ done
**Delivered:** migratable Postgres via Drizzle.
- `db/index.ts` (Neon HTTP driver); `drizzle.config.ts`;
  `db:generate` / `db:migrate` / `db:studio`.
- `db/schema.ts`: `projects` (UUID pk, `name`, `mode` pgEnum
  `team_vs_team|player_vs_player`, `label` = overlay-package folder,
  `picture_url`, `event_date`, timestamps) + a `createProjectSchema` Zod contract;
  `rundowns` (incl. `owner_id` → `users`, `on delete set null`);
  `rundown_items` (`title_key`, `label`, `position`, `data jsonb`).
- Every entity table carries `project_id uuid not null references projects(id)
  on delete cascade` — the isolation pattern in `docs/database.md`.
- Migrations: `0000_naive_prism`, `0001_seed_singleton_project`,
  `0002_smooth_mattie_franklin`.

**Not in P1 (deliberately):**
- **`rundown_items.layer`** — lands as its own migration in
  [the multi-layer plan, Task 1](../plans/2026-06-21-multi-layer-preview-air.md).
- The 3 MIDI collaboration tables — stay in the MIDI plan.

**Plan:** `docs/superpowers/plans/2026-07-01-p1-database-schema.md` (executed).

### P2 — Auth ✅ done
**Delivered:** login, sessions, protected routes.
- `lib/auth.ts` (better-auth + Drizzle adapter, `usePlural: true`,
  `disableSignUp: !allowSignUp` via the `buildAuthOptions()` factory),
  `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `lib/auth-guard.ts`.
- `/login` (RHF + `zodResolver` + MUI), protected `/admin` placeholder with
  `SignOutButton`, `scripts/create-user.ts`, guarded e2e round-trip test.
- Guard is **`proxy.ts`**, not `middleware.ts` — Next 15.5 renamed it and it only
  registers on Next 16. Pure decision logic is factored into
  `lib/auth-guard.ts` (`guardRequest`): API paths get `401`, pages get a
  redirect. The cookie check is **optimistic**; `auth.api.getSession` is the
  authoritative check in every protected page/handler.
- **No public sign-up is a server property** (`disableSignUp`), not a missing UI.
  Only `scripts/create-user.ts` — via its own `allowSignUp: true` instance — can
  create users.
- Route guard is **`proxy.ts`**, not `middleware.ts` — Next 15.5 renamed it, and
  it only registers on Next 16. It gates `/admin/*` and `/api/projects/*` via an
  optimistic session-cookie check. `CLAUDE.md`'s route map still says
  `middleware.ts` and needs updating.
- `requireSession()` — the helper every protected route handler calls.

**Plan:** `docs/superpowers/plans/2026-07-03-p2-auth.md` (executed).

### P3 — Title system (three-file contract + shared models) ✅ done
**Delivered:** the overlay-package + title contract and a working example package.
- **`models/<TitleType>.ts`** — the shared, reusable contract layer: exported Zod
  fields **and** the title's declared **command actions** (`OpeningTimerFields` +
  `OpeningTimerActions = ['start','stop','reset']`; `LowerThirdFields` +
  `LowerThirdActions = []`).
- Per-package three-file contract in `projects/<label>/titles/<key>/`:
  - `model.ts` — composes the shared model (`.omit()` / `.extend()`) so a project
    can skip or add fields; re-exports `actions`.
  - `settings.ts` — presentation **only** (`title_name`, stingers,
    `title_is_full_screen`, …), validated by `titleSettingsSchema`.
  - `index.tsx` — renders from `data`.
- **Contract reconciliation (deviation from the design sketch):** `settings.ts`
  does not also carry `model`/`actions` — the **registry entry** is what composes
  the full title entity (`{ Component, model, actions, settings }`). See
  [titles-system.md](../../titles-system.md#contract-reconciliation-what-the-registry-actually-composes).
- `lib/titles/registry.ts` — accessors (`getTitleEntry`, `getTitleModel`,
  `getTitleActions`, `isDeclaredAction`, `listTitles`) over a **build-time
  codegen** registry (`lib/titles/generated.ts`, emitted by
  `scripts/generate-title-registry.ts`), not a runtime glob/scan — neither
  `import.meta.glob` nor `require.context` works under both Turbopack and
  Vitest.
- `project.config.ts` per package + a **build-time codegen package registry**
  (`lib/projects/generated.ts`, `packages:generate`) feeding the Add Project
  dropdown — a runtime dynamic `import()` was invisible to Next's output file
  tracing and silently dropped packages from the deployed Netlify function.
  `packageExists`/`listOverlayPackageLabels` stay a plain (cheap) filesystem
  scan and guard `label` against path traversal.
- One example package `projects/default/` with `lower-third` and `opening-timer`
  styled in **SCSS** consuming `project.css` CSS variables; `assets:sync` script
  (`projects/*` → `public/projects/*`, Node built-ins only — no `fs-extra`/
  `chokidar`).
- Dev-only preview page at **`app/dev/title-preview`** (not `app/_dev/…` as
  originally sketched — Next's `_`-prefixed private-folder convention excludes
  the whole subtree from routing, so that path could never resolve as a URL;
  a `NODE_ENV` guard keeps the same dev-only intent instead).

**Test:** registry resolves both example titles and exposes their `actions`; a
composed `model.ts` parses valid data and rejects invalid; the codegen scanners
skip an incomplete title/package folder; `assets:sync` copies into
`public/projects/*` and skips a package with no `assets`/`styles`.
**Depends on:** P0.

**Plan:** `docs/superpowers/plans/2026-08-10-p3-title-system.md` (executed).

### P4 — Broadcast bus + SSE + preview/air
**Delivers:** publishing an event visibly shows/hides layered titles on `/air`,
and reloading the window restores them.
- `lib/broadcast/liveSet.ts` — `applyEvent` / `sortLiveSet` / `LiveTitle`
  (`command` events are ignored by the reducer).
- `lib/broadcast/bus.ts` — channel-aware pub/sub keyed by `(rundownId, channel)`
  **with the stateful snapshot** (`publish` folds each event into it via
  `applyEvent`; `getSnapshot(rundownId, channel)`).
- SSE Edge route `app/api/broadcast/[rundownId]/stream/route.ts`
  (`runtime = 'edge'`) that **replays the snapshot as `show` events on connect**,
  then streams live events + heartbeats.
- `/preview/[rundownId]` and `/air/[rundownId]` rendering the **set** via
  `useTitleStream` → `TitleRenderer`, ordered by `(layer, position)` with
  `z-index: layer`. No Redux on these pages.

**Test:** bus unit tests (publish → subscriber receives; snapshot accumulates;
channels and rundowns isolated; `command` doesn't mutate the set); stream route
replays the snapshot **before** live events; an integration check that a
published `show` renders the title on `/air`.
**Depends on:** P0, P3.

> Implement the exact signatures already specified with tests in
> `docs/superpowers/plans/2026-06-21-multi-layer-preview-air.md` (Tasks 3–6) —
> `applyEvent`, `sortLiveSet`, `getSnapshot`, `BroadcastEvent` — rather than
> inventing parallel helpers.

### P5a — Admin workspace: projects, rundowns, items
**Delivers:** an operator can create a project, build a rundown, and edit item data.
**This is where multi-project actually arrives** — the schema already supports it,
so no migration is needed; what's missing is the UI and the route.
- `/admin` **gallery** listing every `projects` row (the seeded `default` row
  shows up as just another card) + **Add Project** (`POST /api/projects`,
  validating `createProjectSchema`), with the `project_label` dropdown fed by the
  package scan; reject a label with no matching folder (`400`).
- Audit that nothing hardcodes the seeded UUID: `grep -rn "00000000-0000" app lib`
  must return nothing.
- Workspace `/admin/[projectId]` with nav **Data** / **Overlays**; Overlays =
  rundown list + rundown CRUD (`/api/projects/[projectId]/rundowns`), each
  rundown setting `owner_id = me`.
- Rundown-item CRUD: the **Add Template** modal (widget name, **Layer** 0–10,
  color, "More settings") and the widget's expandable data form — a **React Hook
  Form** generated from the title's `model.ts`, with validation badges.

**Test:** create project → create rundown → add an item with a chosen `layer` →
item persists and its data validates against the title's model.
**Depends on:** P1, P2, P3.

### P5b — Controller: preview → air
**Delivers:** the operator drives layered graphics onto `/air`.
**Already planned** — execute `docs/superpowers/plans/2026-06-21-multi-layer-preview-air.md`
(14 tasks: `layer` plumbing, `computeTake`, `/take`, `/preview`, `/hide-air`,
`/update`, `/command`, set-based renderer, SSE-derived controller, thread widgets).
Do **not** re-plan this.

**Test:** stage two titles with different layers → **AIR** → both render stacked in
layer order → reload `/air` → both return → take a full-screen title → it clears
the others.
**Depends on:** P4, P5a. **← MIDI feature unblocked after this.**

---

### P6 — Data CRUD *(optional, not needed for MIDI)*
Players / teams / sponsors / assets / videos / brackets / project_css, each the
documented `project_id`-scoped entity with RTK slice + RHF form. Per
`docs/data-entities.md`.

### P7 — Deployment *(optional, not needed for MIDI)*
Netlify + `@netlify/plugin-nextjs`, Neon branching for dev/prod, env wiring,
migration workflow in CI. Per `docs/deployment.md`.

## Chosen path

Build the **full MVP base, P0 → P7**, then regenerate and run the **Multi-User
MIDI Remote** plan (the existing one is stale — see its banner). Plans are written
**one at a time**: write P<n> → execute → write P<n+1>, so each plan reflects what
the previous one actually produced.

- **Build order:** ~~P0 → P1 → P2 → P3~~ (done) → **P4** → P5a → P5b → P6 → P7 →
  MIDI feature.
- **Remaining migrations:** exactly two more are expected —
  `rundown_items.layer` (multi-layer plan, Task 1) and the 3 MIDI collaboration
  tables (MIDI plan). P3, P4, and P5a are migration-free.

## Doc debts — cleared 2026-08-10

All resolved in P2 Task 9; kept here as a record.

- ✅ `docs/tech-stack.md` now pins Next `^16`, `better-auth ^1.6`, drizzle
  `^0.45`/`^0.31`; `docs/getting-started.md` says Node 20.9+.
- ✅ `CLAUDE.md` route map says **`proxy.ts`**; tech-stack line says Next.js 16.
- ✅ `docs/titles-system.md` and `docs/architecture.md` converted from
  **Tailwind** to SCSS modules + CSS variables (the `index.tsx` example now
  ships a matching `.module.scss`). Remaining Tailwind mentions are the
  deliberate rejections in `tech-stack.md` / `projects-system.md`.
- ✅ `better-auth-next` (a package that does not exist on npm) purged from all
  docs; `docs/auth.md` rewritten against the shipped implementation.
- ✅ `docs/database.md` auth tables corrected to `verifications`.
