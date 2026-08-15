# Architecture

## What ETS does

ETS ("Esports Titles System") produces broadcast graphics — lower-thirds, scoreboards, player cards, sponsor bugs, timers, brackets — for live esports streams. An operator enters a **tournament**, builds a **rundown** of **overlays** (titles), and drives them live onto one or more **displays**; OBS or vMix consumes each display's browser-source URL, which renders the live composition on a transparent 1920×1080 canvas fed by Server-Sent Events.

> **This app is a monolith consolidation of three legacy projects.** See [Legacy provenance](#legacy-provenance) at the bottom. The data model and features below are the **real** system (the React frontend `ets-react-poc` is the authority); the runtime is a **Next.js 16 + Postgres re-platform** of it.

## High-level shape

```
                        ┌─────────────────────────────┐
                        │  Operator UI (Next.js pages)│  ←─ MUI + RTK Query
                        │  /projects/[id]/rundowns/... │
                        │  …/controller (live control) │
                        └───────────────┬─────────────┘
                                        │ fetch + mutate
                        ┌───────────────▼─────────────┐
                        │      Next.js API routes      │
                        │  /api/projects/[id]/…  (Node)│
                        └────┬───────────────────┬─────┘
                             │ Drizzle           │ broadcast event bus
                             │                   │ (in-process pub/sub, per display+channel)
                       ┌─────▼─────┐      ┌──────▼──────────────────┐
                       │   Neon    │      │  SSE endpoints           │
                       │ Postgres  │      │  /api/broadcast/[display]│
                       └───────────┘      │    /stream?channel=…     │
                                          └──────────┬───────────────┘
                                                     │ EventSource
                                  ┌──────────────────┴──────────────────┐
                          ┌───────▼────────┐                    ┌────────▼───────┐
                          │ /preview/[uuid]│                    │ /air/[uuid]    │
                          │ (browser source)│                   │ (browser source)│
                          │ transparent 1920×1080, GSAP, SCSS overlays          │
                          └────────────────┘                    └────────────────┘
                                  └──────────── shown in OBS/vMix ────────┘
```

Broadcast output is addressed by a **display UUID**, not a rundown id: one tournament/rundown can drive several **filtered displays** (each overlay carries a `display_filter`).

## Route map

`[projectId]` identifies the **tournament**; `[displayUuid]` is an unguessable display token (treated as a share link, not a secret).

| Route | Auth | Purpose |
|---|---|---|
| `/login` | public | Username + password sign-in (session cookie). See [auth.md](./auth.md). |
| `/projects` | protected | **Tournament gallery** — list/filter tournaments by status, favourites sidebar. No "create"; tournaments are entered, not authored here. |
| `/projects/[projectId]` | protected | Tournament hub. Workspace links: **Data**, **Overlays**, **MIDI**, **Bluetooth**. |
| `/projects/[projectId]/data` | protected | CRUD for the entities absorbed from the backoffice: Players, Teams, Talents, Sponsors, Tags/Disciplines, Assets, Themes, Videos, Brackets/Matches. See [data-entities.md](./data-entities.md). |
| `/projects/[projectId]/rundowns` | protected | List / create / rename / delete rundowns. |
| `/projects/[projectId]/rundowns/[rundownId]` | protected | **Overlay editor** — build the rundown's ordered overlay list, configure each. See [rundowns.md](./rundowns.md). |
| `/projects/[projectId]/rundowns/[rundownId]/controller` | protected | **Live control panel** — preview → air, per-overlay show/hide, live-update, thread widgets. |
| `/projects/[projectId]/midi` | protected | Map MIDI notes → overlay/event actions. Roadmap. See [roadmap.md](./roadmap.md). |
| `/projects/[projectId]/bluetooth` | protected | Pair BLE heart-rate straps → heart-rate overlays. Roadmap. |
| `/preview/[displayUuid]` | public | Operator preview channel for a display. See [preview-air.md](./preview-air.md). |
| `/air/[displayUuid]` | public | On-air channel — OBS/vMix browser source. |
| `/api/projects/[projectId]/...` | protected | REST endpoints, all `project_id`-scoped. |
| `/api/broadcast/[displayUuid]/stream?channel=preview\|air` | public | SSE endpoint. |

> **Overlays = the operator-facing name for a rundown's titles.** The underlying tables are `rundowns` / `rundown_overlays`. "Title" and "overlay" are used interchangeably (see [titles-system.md](./titles-system.md)).

## Data flow at a glance

1. **Author entity data (Data section).** Players, teams, talents, sponsors, brackets/matches, themes are edited through `/api/projects/[projectId]/...` and stored in Postgres, `project_id`-scoped. See [data-entities.md](./data-entities.md), [state-management.md](./state-management.md).
2. **Build a rundown.** A rundown is an ordered list of `rundown_overlays`; each names an overlay (`model` — the kebab registry key), its `layer`/`color`/`display_filter`/`is_fullscreen`/mixers, and its operator-edited config (`data.widget`). See [rundowns.md](./rundowns.md).
3. **Drive the show (controller).** Staging an overlay publishes to the **preview** channel; taking it publishes to **air**. The server collects the overlay's live render payload (its `data` serializer pulls in the current match/participants/sponsors) and pushes a `preview`/`air`/`live_update`/`hide`/`play_mixer` event over the in-process bus, keyed by `(displayUuid, channel)`.
4. **OBS receives a frame update.** Each display's `/air` or `/preview` page subscribes via `EventSource`, filters by `display_filter`, matches `model` to its overlay component, runs the GSAP in/out animation (and any stinger mixer), and renders the payload.

## Cross-cutting decisions

Reused across docs; each is detailed in the file noted.

1. **Tournaments (not "projects you create"); overlays are global** ([projects-system.md](./projects-system.md), [database.md](./database.md)). A "project" **is a tournament** — the operator browses/favourites/enters it; there is no Add-Project flow and no `project_mode`/`project_label`. Overlay components are **global**, organized by **discipline (category) / template (widget)** — not per-tournament "packages."
2. **`project_id` FK isolation, enforced by URL routing** ([database.md](./database.md)). Every entity row has a `project_id` column; every entity route lives under `/api/projects/[projectId]/...`, so scoping is structural and the project id is never trusted from the request body.
3. **Overlay config is JSONB, validated at the API boundary** ([titles-system.md](./titles-system.md), [rundowns.md](./rundowns.md)). Each overlay's operator-editable fields (a **widget schema**: `input_type`, `choices`, `default`, `required`, `can_live_update`) drive the admin form and validate writes into `rundown_overlays.data.widget`. Adding/editing an overlay needs no migration.
4. **SSE, not WebSockets, for the live composition** ([preview-air.md](./preview-air.md)). One-way server→client carries `air`/`preview`/`hide`/`live_update`/`play_mixer`/`display_change`. WebSockets are used only for the timer and heart-rate subsystems (roadmap).
5. **Displays as the broadcast unit** ([preview-air.md](./preview-air.md)). Output is addressed by display UUID; `display_filter` routes overlays to specific displays so one tournament drives many outputs.
6. **Split UI: MUI for admin, SCSS + GSAP for overlays** ([tech-stack.md](./tech-stack.md), [titles-system.md](./titles-system.md)). Admin pages use MUI; overlay components use SCSS modules + runtime theme CSS variables, with GSAP in/out animations and video stinger mixers.

## Roadmap subsystems

Real, shipped in the etalon, staged for the monolith: **MIDI** control surfaces, **Bluetooth heart-rate**, the **WebSocket timer**, **MRI** (Marvel Rivals) proxy draft/stats streams, **ATEM camera switching** (seating), and **API-driven themes**. See [roadmap.md](./roadmap.md).

## Legacy provenance

This monolith consolidates three projects; knowing which area came from where helps when reconciling behavior:

- **`esports-titles-system-react`** (Django/DRF) — the direct ancestor of **rundowns, overlays, displays, the widget/data serializer split, SSE preview/air, MIDI, seating**.
- **`ets-react-poc`** (React 18) — the **etalon**: operator UI, the controller, the broadcast renderer (GSAP + mixers), routes, and the authoritative data shapes.
- **`react-backoffice`** (React 16) — the CRUD admin for the shared weplay microservices (**tournaments, players, teams, sponsors, talents, brackets**); those entity services are **absorbed into the monolith as local `project_id`-scoped tables**.
