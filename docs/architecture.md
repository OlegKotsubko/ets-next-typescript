# Architecture

## What ETS does

ETS produces broadcast graphics (lower-thirds, scoreboards, player cards, sponsor bugs) for live streams. The operator drives a rundown from the admin UI; OBS or vMix consumes one or more browser-source URLs that render the live graphics composition.

## High-level shape

```
                            ┌────────────────────────┐
                            │  Admin (Next.js page)  │  ←─ operator UI (MUI, RTK Query)
                            │       /admin/...        │
                            └───────────┬────────────┘
                                        │ fetch + mutate
                            ┌───────────▼────────────┐
                            │   Next.js API routes    │
                            │   /api/projects/[id]/…  │
                            │   (Node runtime)        │
                            └─────┬───────────────┬──┘
                                  │ Drizzle      │ broadcast event bus
                                  │              │ (in-process pub/sub)
                            ┌─────▼─────┐  ┌────▼────────────────────┐
                            │   Neon    │  │  SSE endpoints (Edge)    │
                            │ Postgres  │  │  /preview/[id]/stream    │
                            │           │  │  /air/[id]/stream        │
                            └───────────┘  └─────────┬────────────────┘
                                                     │ EventSource
                                       ┌─────────────┴──────────────┐
                                       │                            │
                              ┌────────▼─────────┐         ┌────────▼─────────┐
                              │ /preview/[id]    │         │ /air/[id]        │
                              │ (browser source) │         │ (browser source) │
                              │ SCSS titles      │         │ SCSS titles      │
                              └──────────────────┘         └──────────────────┘
                                       │                            │
                                       └────── shown in OBS ────────┘
                                              (operator preview /
                                               on-air program)
```

## Route map

`[projectId]` is the project **UUID** (projects are UI-created event instances, not folder slugs — see [projects-system.md](./projects-system.md)).

| Route | Auth | Purpose |
|---|---|---|
| `/login` | public | Email + password sign-in (Zod-validated). See [auth.md](./auth.md). |
| `/admin` | protected | Project gallery + **Add Project** (creates a `projects` row; picks an overlay package via `project_label`). |
| `/admin/[projectId]` | protected | Project hub. Two workspace links: **Data** and **Overlays**. |
| `/admin/[projectId]/data` | protected | CRUD for Players, Talents, Teams, Sponsors, Assets, Videos, Brackets, Project CSS. See [data-entities.md](./data-entities.md). |
| `/admin/[projectId]/overlays` | protected | List overlays (rundowns) and create new ones. |
| `/admin/[projectId]/overlays/[rundownId]` | protected | Overlay editor — add overlays, configure, drive AIR/HIDE. See [rundowns.md](./rundowns.md). |
| `/preview/[rundownId]` | public | Operator preview channel. See [preview-air.md](./preview-air.md). |
| `/air/[rundownId]` | public | On-air channel — OBS/vMix browser source. |
| `/api/projects` | protected | `POST` creates a project; `GET` lists them. |
| `/api/projects/[projectId]/...` | protected | REST endpoints, all `project_id`-scoped. |
| `/preview/[id]/stream`, `/air/[id]/stream` | public | SSE endpoints, **`runtime = 'edge'`**. |

> **Overlays = Rundowns.** The operator-facing section is named **Overlays**; the underlying data model and tables are still `rundowns` / `rundown_items`. See [rundowns.md](./rundowns.md).

## Data flow at a glance

1. **Admin authors content.** The operator edits Players, Teams, etc. in the Data section. RTK Query mutations write through `/api/projects/[projectId]/...`. See [state-management.md](./state-management.md).
2. **Admin builds a rundown.** A rundown is an ordered list of `rundown_items`, each pointing to a title (`titleKey`) plus its config blob (`data jsonb`). See [rundowns.md](./rundowns.md).
3. **Operator drives the show.** Clicking AIR on a rundown item dispatches a `show` event to the in-process event bus, keyed by `rundownId`. The bus pushes the event to all subscribers on `/air/[id]/stream` (and `/preview/[id]/stream`).
4. **OBS receives a frame update.** The browser source page subscribes via `EventSource`, matches the incoming `titleKey` to its imported title component, and renders it with the SSE payload as the `data` prop.

## Six cross-cutting decisions

These decisions are reused across multiple docs; each is detailed in the file noted in parentheses.

1. **File-system for overlay packages, database for projects and entities** ([projects-system.md](./projects-system.md), [database.md](./database.md)). A `projects/<label>/` folder is a reusable *overlay package* (overlay components, CSS, fonts, title videos/backgrounds). A *project* is a UI-created broadcast event (`projects` row, UUID) that selects a package via `project_label`. All mutable per-event data (players, talents, teams, sponsors, brackets, overlays) lives in Postgres keyed by `project_id`.
2. **Single source of truth per title via `model.ts`** ([titles-system.md](./titles-system.md)). One Zod schema generates the admin form fields, validates RTK Query mutations, and validates SSE payloads on both server and client.
3. **SSE, not WebSockets** ([preview-air.md](./preview-air.md)). One-way server → client is sufficient for `show`/`hide`/`update`. SSE is simpler, works through CDNs, and aligns with Edge runtime.
4. **Edge runtime only for streaming routes** ([deployment.md](./deployment.md)). The rest of the app runs on Node so `@neondatabase/serverless` and `better-auth` work normally.
5. **Split UI: MUI for admin, SCSS for titles** ([tech-stack.md](./tech-stack.md), [titles-system.md](./titles-system.md)). Admin pages use MUI. Title components under `projects/<slug>/titles/*` use SCSS modules + `project.css` CSS variables only.
6. **`project_id` FK isolation, enforced by URL routing** ([database.md](./database.md)). Every entity row has a `project_id uuid` column referencing `projects.id`. All entity routes live under `/api/projects/[projectId]/...` so the filter is structurally enforced and the project ID is never trusted from the request body.

## Out of MVP scope

Documented but not built: **MIDI** (hardware control surfaces) and **Bluetooth** (presenter remotes). See [roadmap.md](./roadmap.md).
