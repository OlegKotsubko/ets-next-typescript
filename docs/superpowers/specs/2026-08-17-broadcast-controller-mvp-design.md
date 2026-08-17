# Broadcast + Controller — MVP Vertical Slice (Design)

**Date:** 2026-08-17
**Status:** Approved (design), pending plan
**Pass:** Broadcast + controller (Pass 2 of "titles → rundown, then controller").

## Goal

Drive a rundown's overlays from a **controller** UI onto OBS/vMix browser sources
(`/preview/[uuid]`, `/air/[uuid]`), live, over an in-process **SSE** bus. MVP
vertical slice: get overlays on air end-to-end; defer stingers, match/seating,
and thread-widget actions.

## Context

The editor pass ships the ability to build a rundown of overlays
(`rundown_overlays.data.widget`). The overlay components + build-time registry
(`getOverlayRender(model)` → `{ Component, animationIn, animationOut }`) render
from a `data` prop. **No broadcast infrastructure exists** — no `/preview`,
`/air`, `/broadcast` routes; no SSE bus; no `displays`/`settings` tables (only the
`display_filter` column on `rundown_overlays`).

The target is already specified in [`docs/preview-air.md`](../../preview-air.md) and
the controller section of [`docs/rundowns.md`](../../rundowns.md). The etalon
(`ets-react-poc`) governs client behavior, the event set, and shapes:
- SSE per display uuid per channel; events `air`, `preview`, `live_update`,
  `hide`, `hide_all`, `event`, `play_mixer`, `display_change`
  (`src/hooks/useAirServerEvent.js`).
- Air page renders a **set** (`airs.map(<SuspendedTitle>)`) keyed by id, sorted by
  layer (`src/pages/air/Air.js`); reducer keyed by `_id` with add/live_update/hide
  (`src/redux/reducers/airsSlice.js`).
- Publisher routes `POST /events/air|hide_all|{id}/hide|{id}/event`
  (`src/api/events.js`).

Our monolith re-decided the transport: an **in-process Node bus** (not Django
SSE), per architecture decisions 5–6.

## Scope

**In (MVP vertical slice):**
- `displays` table + CRUD; minimal per-user `settings` (active display).
- In-process Node **bus** (pub/sub keyed by `uuid:channel`, snapshot for replay).
- **SSE stream** route (Node, public).
- `/preview/[uuid]` + `/air/[uuid]` **renderer pages** (transparent 1920×1080,
  set-based, layer-sorted, GSAP via existing components, reconnect-safe).
- **Publisher routes**: preview (stage), air (take), hide, hide_all, live_update.
- **Controller UI**: display picker, overlay list with Stage/Take/Hide, Hide-all,
  two iframe monitors (preview + air), live-update of `can_live_update` fields.

**Out (deferred):**
- Video stinger **mixers** / `play_mixer`.
- **Match/seating** panel and participant/sponsor payload collection (MVP payload
  is the overlay row + `data.widget` only).
- **Thread-widget `event`** actions (timer start/stop, `next`) + buttons.
- `display_change`; multi-channel rundowns; scheduled transitions.
- **`rundown_overlay_data`** persistence — live state is transient in the bus
  snapshot, never persisted (decision 5).
- Broader `settings` fields (timezone, delay, channel, atem_ip, observer,
  is_guest).

## Load-bearing decisions

1. **Transient live state; no `rundown_overlay_data`.** On-air/preview state lives
   only in the bus snapshot (replayed on reconnect), never persisted. The only
   migration is `displays` + minimal `settings`.
2. **Controller monitors are iframes** of the real `/preview/[uuid]` +
   `/air/[uuid]` pages — WYSIWYG with OBS, no duplicated render logic; they update
   via their own SSE connections.
3. **MVP payload = overlay row + `data.widget`.** No match/participants/sponsors
   collection yet (overlay components already tolerate a missing `match`).
4. **Node runtime everywhere** for the bus/SSE/publisher routes — an Edge SSE route
   can't see a Node `publish()` (separate bundles/module state), which breaks the
   bus even in `next dev` (decision 6).

## Data model (one migration)

```
displays
  id serial pk
  uuid text unique not null default (unguessable token)
  name text not null
  project_id integer -> projects(id) cascade
  created_at timestamptz default now()

settings                     -- minimal; per-user active display
  user_id text pk -> user(id) cascade
  display_id integer -> displays(id) set null (nullable)
  updated_at timestamptz default now()
```

`displays` CRUD lives under `/api/projects/[projectId]/displays`; `settings` is
read/written at `/api/settings` (current user from session).

## The in-process bus — `lib/broadcast/bus.ts` (Node)

Module-level pub/sub keyed by `` `${displayUuid}:${channel}` `` (`channel ∈
preview|air`). Per key: a set of subscribers + a **snapshot** (the current
`Map<overlayId, payload>`). A snapshot reducer applies each event so a late
subscriber can be replayed the current set as one `air`/`preview` message.

Interface (pure, unit-testable — no HTTP):
```ts
type Channel = 'preview' | 'air'
type BroadcastEvent =
  | { type: 'air' | 'preview'; data: OverlayPayload[] }      // full set (replay/take)
  | { type: 'hide'; data: { id: number } }
  | { type: 'hide_all'; data: Record<string, never> }
  | { type: 'live_update'; data: { id: number; widget: Record<string, unknown> } }
publish(uuid: string, channel: Channel, event: BroadcastEvent): void
subscribe(uuid: string, channel: Channel, cb: (e: BroadcastEvent) => void): () => void
getSnapshot(uuid: string, channel: Channel): OverlayPayload[]   // current set
```
`OverlayPayload` = the overlay row fields the renderer needs (`id`, `model`,
`category`, `template`, `layer`, `displayFilter`, `isFullscreen`, `data.widget`).

Single-server caveat (decision 5): the bus is process memory; multi-instance needs
a broker — out of MVP scope.

## SSE stream route — `app/api/broadcast/[displayUuid]/stream/route.ts` (Node, public)

`GET …/stream?channel=preview|air` → `text/event-stream`. `export const runtime =
'nodejs'`. On connect: write the snapshot as one `air`/`preview` event, then
`subscribe()` and forward each event as a named SSE event (`event: <type>\n data:
<json>`). Close/unsubscribe on `request.signal` abort. Unauthenticated — the uuid
is the token.

## Renderer pages — `app/(broadcast)/preview/[displayUuid]/page.tsx` + `…/air/[displayUuid]/page.tsx`

A new route group `app/(broadcast)/` with a **transparent, MUI-free** root layout
(no `CssBaseline`). Each page is a thin client wrapper around a shared hook +
component:
- `lib/broadcast/useBroadcastChannel.ts` — opens `EventSource`
  (`/api/broadcast/{uuid}/stream?channel=…`), maintains a `Map<id, LiveOverlay>`
  reducer (`air`/`preview` replace the set; `hide` deletes; `hide_all` clears;
  `live_update` merges `data.widget` by id), filters by the `?filter=`
  display_filter, and **holds its set across auto-reconnect**.
- `components/broadcast/OverlayCanvas.tsx` — renders the set: for each overlay,
  `getOverlayRender(model).Component` at `style={{ position:'absolute',
  zIndex: layer }}`, running `animationIn` on mount / `animationOut` on removal.
  Transparent full-viewport container.

MVP payload feeds `data = { widget }`; `match` is omitted (components tolerate it).

## Publisher routes (protected, project-scoped, Node)

Under `app/api/projects/[projectId]/broadcast/[displayId]/…`, `projectId` +
`displayId` from the URL, session-guarded. Each loads the display (→ uuid) and the
referenced overlay, then calls `publish()`:

| Route | Body | Effect |
|---|---|---|
| `POST …/preview` | `{ overlayId }` | build payload → `publish(uuid,'preview', preview-set + overlay)` |
| `POST …/air` | `{ overlayId }` | if overlay `is_fullscreen` first publish `hide_all` on air, then add to air set |
| `POST …/hide` | `{ overlayId, channel }` | `publish(uuid, channel, {type:'hide', data:{id}})` |
| `POST …/hide_all` | `{ channel }` | `publish(uuid, channel, {type:'hide_all'})` |
| `POST …/live_update` | `{ overlayId, widget }` | validate against the overlay model's `can_live_update` fields → `publish live_update` |

The preview/air "set" is derived from the bus snapshot + the newly staged overlay
(add/replace by id), computed server-side so the renderer just draws the set.

## Controller UI — `app/(admin)/projects/[projectId]/rundowns/[rundownId]/controller/page.tsx`

- **Display picker** — lists `displays` (create-inline if none); selection persists
  via `settings`. Drives which uuid the publisher routes target and which the
  iframes point at.
- **Overlay list** — the rundown's overlays; each row has **Stage** (preview),
  **Take** (air), **Hide**; plus a global **Hide all**. RTK mutations to the
  publisher routes.
- **Monitors** — `<iframe src="/preview/{uuid}">` + `<iframe src="/air/{uuid}">`
  (scaled down), the exact OBS view.
- **Live-update** — for the selected overlay, a compact form of only its
  `can_live_update` fields → `live_update`.
- Reached via a **"Controller"** link from the rundown editor and/or the rundowns
  list.

RTK: a `broadcastApi` slice (preview/air/hide/hide_all/live_update mutations) +
`displaysApi` + `settingsApi`.

## Testing

- **Bus** (`lib/broadcast/bus.ts`): publish→subscribe delivery; snapshot replay on
  late subscribe; reducer for hide/hide_all/live_update/air-replace. Unit.
- **Renderer reducer** (`useBroadcastChannel` reducer, extracted pure): set
  add/replace, `hide` delete, `hide_all` clear, `live_update` merge, layer sort,
  display_filter filter. Unit.
- **SSE route**: connecting replays the snapshot then streams a subsequent publish
  (node-env test with a mocked/real bus).
- **Publisher routes**: preview/air/hide/hide_all/live_update validate + publish;
  full-screen take clears air first; `projectId`/`displayId` from URL not body;
  live_update rejects non-`can_live_update` fields. Mocked bus + db (matches
  existing route-test pattern).
- **displays / settings routes**: CRUD + active-display persistence (mocked db).
- Gate: `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
  Browser smoke: operator drives the logged-in controller; confirm `/air/{uuid}`
  shows/updates/hides overlays (user-driven, since admin routes are auth-gated).

## Non-goals / deferred

Stinger mixers (`play_mixer`, `in/out/inner_mixer`, cut points); match/seating +
participant/sponsor collection; thread-widget `event` actions and buttons;
`display_change`; multi-channel; scheduled/timed transitions;
`rundown_overlay_data` persistence; broader `settings` fields; MIDI/Bluetooth/ATEM.
All are documented roadmap items.
