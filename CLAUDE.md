# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state of the repository

**There is no application code yet.** The repo currently contains only `docs/` (the authoritative spec), `screenshots/` (reference UI), and `README.md`. The `app/`, `db/`, `scripts/`, `projects/`, `lib/`, `store/`, `public/projects/`, and `package.json` referenced throughout the docs are **planned, not present**. When implementing, follow `docs/` as the source of truth — it contains concrete code sketches (schema, route handlers, hooks, configs) for every part of the system. Start at `docs/README.md`, which orders the docs for a new developer.

## What ETS is

A Next.js app that serves broadcast graphics (lower-thirds, scoreboards, player cards, sponsor bugs) to OBS/vMix via browser sources. An operator drives a live show from an admin UI (`/admin`); the `/preview` and `/air` pages render the same React title components, fed by Server-Sent Events.

## Commands (as specified in docs — wire these into `package.json` when scaffolding)

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000. `predev` runs `titles:generate && packages:generate && assets:sync` first. |
| `npm run build` | Production build. `prebuild` runs the same `titles:generate && packages:generate && assets:sync` chain first. |
| `npm run titles:generate` | Scan `projects/*/titles/*` → emit `lib/titles/generated.ts` (static imports; codegen, not a runtime glob — see `docs/titles-system.md`). |
| `npm run packages:generate` | Scan `projects/*` for `project.config.ts` → emit `lib/projects/generated.ts` (same codegen reasoning as titles). |
| `npm run db:generate` | Diff `db/schema.ts` vs `db/migrations/` → emit a new SQL migration. |
| `npm run db:migrate` | Apply pending migrations to `$DATABASE_URL`. **Never run inside `next build`.** |
| `npm run db:studio` | Open Drizzle Studio (browser DB inspector). |
| `npm run assets:sync` | One-shot copy of `projects/*/{assets,styles}` → `public/projects/*`. Chained into `predev`/`prebuild`. |
| `npm run dev:assets` | Same sync, `--watch`. **Manual only** — `predev` does not start it; run it in its own terminal for live asset edits during `npm run dev`. |
| `npx tsx scripts/create-user.ts <email> <password>` | Bootstrap a user (no public sign-up). |

> There is **no `projects:sync`** anymore. Projects are created from the UI (`POST /api/projects`); overlay-package folders under `projects/` are discovered by a directory scan (`packageExists`/`listOverlayPackageLabels`), while the packages themselves are read via the codegen registry above.

Titles are iterated visually via a dev-only preview page at `/dev/title-preview` (`app/dev/title-preview/page.tsx` — not `app/_dev/…`; Next's `_`-prefixed private-folder convention would exclude it from routing entirely). It 404s in production via a `NODE_ENV` guard. There is no test runner specified beyond Vitest (`npm test`).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · better-auth (email+password) · Zod · React Hook Form (admin forms, `zodResolver`) · Drizzle ORM + Neon Postgres (`@neondatabase/serverless` HTTP driver) · MUI (admin only) · SCSS (title components only) · Redux Toolkit + RTK Query · Netlify (`@netlify/plugin-nextjs`). Full rationale: `docs/tech-stack.md`.

## Architecture: the load-bearing decisions

These are the patterns that span multiple files. Internalize them before writing code.

1. **Overlay packages (file-system) vs. projects (database).** A `projects/<label>/` folder is a reusable *overlay package* (config, overlay components, CSS, fonts, title videos/backgrounds). A *project* is a UI-created broadcast event — a `projects` row with a **UUID** id — that selects one package via `project_label` (a dropdown of folder names). Many projects can reuse one package. All mutable per-event data (players, talents, teams, sponsors, brackets, overlays) lives in Postgres keyed by `project_id`. See `docs/projects-system.md`, `docs/database.md`.

2. **`project_id` FK isolation, enforced by URL routing.** Every entity table has `project_id uuid not null references projects(id) on delete cascade`. Every entity API route lives under `/api/projects/[projectId]/...` (where `projectId` is the project UUID) and the server derives `projectId` **from the URL, never from the request body**. There is no `getAllPlayers()` — only project-scoped queries. RTK Query cache tags always include the project ID. This is the most important pattern in the codebase — read `docs/database.md` "Multi-tenancy" before adding any entity. **Broadcast asset/CSS paths use `project.label` (the folder), not `projectId` (the UUID).**

3. **One Zod `model.ts` per overlay is the single source of truth; `settings.ts` is the third file.** Each overlay component (`projects/<label>/titles/<key>/`) is exactly three files: `index.tsx` (React component, `data` prop only), `model.ts` (Zod schema for operator-editable fields), and `settings.ts` (author-time presentation: `title_name`, `title_preview`, `title_stinger_in`/`out`, `title_color`, `title_background`, `title_video`, `title_is_full_screen`). The `model.ts` schema drives (a) the admin edit form, (b) server-side mutation validation, (c) SSE payload validation on both ends. `settings.ts` is presentation **only**, read from the registry by `titleKey` (it never travels in the SSE payload) — the full title entity (`{ Component, model, actions, settings }`) is composed by the **registry**, not any single file. A shared, reusable contract layer lives in top-level `models/<TitleType>.ts` (e.g. `OpeningTimerFields` + `OpeningTimerActions = ['start','stop','reset']`); a package's `model.ts` composes it with `.omit()`/`.extend()` and re-exports `actions` — the declared command allow-list `isDeclaredAction()` validates against. Both the title registry and the overlay-package registry are **build-time codegen** (`titles:generate`, `packages:generate`), not a runtime glob/scan, because neither `import.meta.glob` nor `require.context` works under both Turbopack and Vitest, and a runtime dynamic `import()` is invisible to Next's output file tracing in production. See `docs/titles-system.md`.

4. **Title data is JSONB, validated at the API boundary — never its own table.** `rundown_items.data jsonb` holds each title instance's config, parsed against the title's `model.ts` before insert. Adding/editing a title needs **no migration**. Adding a CRUD entity or column **does**. The action→command table is in `docs/database.md`.

5. **SSE over an in-process event bus, not WebSockets, not the DB.** Clicking AIR publishes a `show`/`hide`/`update` event to an in-memory pub/sub keyed by `rundownId` (`lib/broadcast/bus.ts`); on-air state is transient and never persisted. SSE endpoints stream it to `/preview` and `/air`. The bus is single-instance only — see the caveat below. Contract in `docs/preview-air.md`, `docs/rundowns.md`.

6. **Edge runtime *only* for SSE streaming routes** (`export const runtime = 'edge'`). Everything else runs on Node so the Neon driver, better-auth, and fs access work normally. Netlify Functions cap at 10s; SSE streams are long-lived, so they must be Edge. See `docs/deployment.md`.

7. **Split UI: MUI for admin, SCSS for titles — never mixed.** Title components use SCSS (`.module.scss`) + CSS variables only (no MUI import, no inline hex, no raw font-family). Brand colors/fonts come from each project's `project.css` (`@font-face` + `:root` variables) which the title SCSS consumes via `var(--…)` — no build-time theme-config mapping. Re-skinning a project means editing CSS, not titles. Use `font-display: block` (not `swap`) in broadcast contexts. See `docs/projects-system.md` font pipeline.

## Route map

- `/login` (public) — only public admin page.
- `/admin` (gallery + **Add Project**), `/admin/[projectId]/{data,overlays,overlays/[rundownId]}` (protected via `proxy.ts` — Next 16's rename of `middleware.ts` — gating `/admin/*` and `/api/projects/*`). Workspace nav is two links: **Data** and **Overlays** (Overlays = the rundown/controller system; underlying tables keep the `rundowns`/`rundown_items` names).
- `/preview/[rundownId]`, `/air/[rundownId]` (**public** — OBS/vMix browser sources; rundown IDs are unguessable UUIDs, treated as share-link tokens, not secrets). These pages do **not** use Redux — everything flows through the SSE `data` prop.
- `/api/projects` (`POST` create / `GET` list) · `/api/projects/[projectId]/...` (protected REST) · `/api/broadcast/[rundownId]/stream?channel=preview|air` (public SSE, Edge).

## State management

RTK Query = all server cache (one API slice per entity: `playersApi`, `teamsApi`, …; tags always include `projectId`). A thin `editor` Redux slice = ephemeral UI state only (selected item, on-air highlight, preview toggle). Never store server data in a slice; never `fetch` from a component. See `docs/state-management.md`.

## Migrations vs project creation vs packages (commonly confused)

- `db:migrate` = schema/DDL changes (new table, new/renamed column). Workflow: edit `db/schema.ts` → `db:generate` → commit the SQL → `db:migrate` against the right `DATABASE_URL` (dev, then prod separately).
- **Creating a project** = a single `projects` row inserted by `POST /api/projects` from the UI. No migration, no script.
- **Adding an overlay package / overlay / editing `settings.ts`/`model.ts`** = file-system change only; discovered by scan. No DB change.

## Single-server pub/sub caveat

The broadcast bus lives in process memory. It works because the operator's admin tab and the OBS source hit the same Netlify Edge region for a given rundown. Scaling to multiple instances would require a cross-instance broker (Redis pub/sub, Postgres `LISTEN/NOTIFY`). Out of MVP scope but document if you touch the bus.

## Out of MVP scope

MIDI control surfaces, Bluetooth presenter remotes, scheduled/timed transitions, transition animations, multi-channel rundowns (one on-air title per rundown at a time). See `docs/roadmap.md`.
