# Preview & Air (the broadcast output)

`/preview/[displayUuid]` and `/air/[displayUuid]` are the **broadcast-output pages** — what OBS/vMix load as browser sources. They render a **transparent 1920×1080 canvas**, are **unauthenticated** (the display UUID is the token), and are driven entirely by **Server-Sent Events** — never a `data` prop, never Redux on the page.

## Addressing: displays, not rundowns

Output is addressed by a **display** (see [database.md](./database.md#4-displays--per-user-settings)), not a rundown. A display has a public `uuid`; one tournament/rundown drives **many** displays, and each overlay carries a **`display_filter`** (`''` = all, or `1`–`10`) so a take routes only to matching displays. The operator selects a display in Settings; the controller pushes to that display's channels.

- Preview page: `GET /preview/[displayUuid]`
- Air page: `GET /air/[displayUuid]`
- SSE stream: `GET /api/broadcast/[displayUuid]/stream?channel=preview|air` (internally, channel `display-{uuid}-{air|preview}`)

## The event set

The stream carries (etalon `EventType`):

| Event | Meaning |
|---|---|
| `air` | The full current air set for the display (also used to (re)hydrate on connect). |
| `preview` | Stage an overlay on the preview channel. |
| `live_update` | Merge new `data.widget` into an already-live overlay by id (no re-enter animation). |
| `hide` | Remove one overlay from the channel (plays its exit animation). |
| `hide_all` | Clear the display. |
| `play_mixer` | Play a full-screen stinger video over the canvas. |
| `event` | A declared overlay action (thread widget), e.g. a timer `start`/`stop`, or `next`. |
| `display_change` | The display's tournament changed (re-scope). |

Each `air`/`preview` message carries the overlay's `model`, `layer`, `category`, `template`, `display_filter`, mixers, and its collected `data` (`{ widget, match, participants, sponsors, … }`).

## Set-based rendering

A display renders a **set** of overlays, not one at a time. The client keeps a `Map<overlayId, LiveOverlay>` reducer:

- `air`/`preview` → set/replace; `live_update` → merge `data`; `hide` → delete; `hide_all` → clear.
- Filter incoming events by `display_filter` (only render overlays for this display).
- Sort by **`layer`** (1–7; higher on top) for z-order; each overlay renders at `style={{ zIndex: layer }}`.

The client **holds its set across EventSource auto-reconnects** and the reconnect re-hydrates from the current `air` snapshot, so a dropped connection is visually seamless.

### The full-screen-clears-air rule (the take)

Taking a **full-screen** overlay (`is_fullscreen`) first hides everything currently on air, then shows the staged set — computed once, server-side, in the take handler (not in each renderer). Non-full-screen takes stack additively onto the current air set. The renderer just draws whatever set it is told.

## Stingers & mixers

Overlays reveal through **GSAP** enter/exit timelines and optional video **stinger mixers**:

- `in_mixer` / `out_mixer` — enter/exit stinger webms, timed so the overlay appears at the stinger's midpoint (the etalon's `VideoMixer` + `Animation` components).
- `inner_mixer` — a looping bed behind the overlay content.
- `play_mixer` event — a full-screen stinger played over the whole canvas between compositions.
- `background_video` / `background_image` — per-overlay background bed (`TitleBackground`).

Theme colors/fonts come from the active tournament theme as CSS variables written to `:root` at runtime ([projects-system.md](./projects-system.md#theming)).

## Reload recovery

The stream **replays the current set** to every newly-connecting client (as `air`/`preview` events) before streaming live ones, so an OBS source refresh — or an operator reload — restores exactly what was on screen. State is transient (in process memory), never persisted; it survives a window reload while the instance stays warm, but not a full server restart (the single-server caveat below).

## The in-process bus

Publishing is an in-process pub/sub keyed by `(displayUuid, channel)`, holding a stateful snapshot per key (for replay). The AIR/TAKE/preview/hide routes (Node — they need `auth` + `db`) call `publish()`; the SSE stream `subscribe()`s and forwards.

### Caveat: single-server pub/sub

The bus lives in process memory and only works when publisher and subscriber share one process — true in `next dev` and on a single always-on server. A multi-instance/serverless deployment needs a cross-instance broker (Redis pub/sub, Postgres `LISTEN/NOTIFY`); out of MVP scope.

### Caveat: the Edge/Node runtime split

If the SSE stream route is `runtime = 'edge'` while the publisher routes are Node, they compile to **separate bundles with separate module state** — a Node `publish()` never reaches the Edge subscriber, even in `next dev`. Resolve by keeping both in one runtime — make the SSE route **Node** (it's public, and Neon's HTTP driver runs on Node), which is exactly what an always-on-server deploy wants (no serverless ~10s cap; see [deployment.md](./deployment.md)). On serverless you'd instead accept ~10s reconnect churn (softened by the client holding its set across reconnects) or introduce the broker above. This must be settled before wiring the Node publisher.

## OBS / vMix setup

- Add a **Browser Source** pointing at `https://<host>/air/<displayUuid>` (and a second at `/preview/<displayUuid>` for the operator's preview monitor).
- Size **1920×1080**; leave the background transparent (the page paints none).
- Refreshing the source re-hydrates from the snapshot — nothing is lost.
