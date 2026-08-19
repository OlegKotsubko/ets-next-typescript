# Roadmap

## Core — what this monolith builds

The core is everything described in the rest of the docs:

- **Authentication.** Username + password (session cookie) via better-auth; no public sign-up; a **guest-user** flow (a guest lands on their rundown's controller). See [auth.md](./auth.md).
- **Tournaments.** `/projects` is a **tournament gallery** — browse/filter by status, favourite, and enter (tournaments are not created here). See [projects-system.md](./projects-system.md#projects-are-tournaments).
- **Tournament workspace.** Links: **Data**, **Overlays**, **MIDI**, **Bluetooth**.
- **Data CRUD.** Players (+ typed photos), Teams (+ logos, roster with captain/stand-in), Talents, Sponsors, Matches & Brackets, Themes, Assets, Videos — all `project_id`-scoped. See [data-entities.md](./data-entities.md).
- **Overlays (rundowns).** Build a rundown of overlays; configure each from its **widget schema** (`input_type`/`choices`/`can_live_update`); set `layer`, `color`, `display_filter`, `is_fullscreen`; reorder; delete. See [rundowns.md](./rundowns.md), [titles-system.md](./titles-system.md).
- **Controller.** Preview → air switching with a layered composition, per-overlay hide / hide-air, live-update (only `can_live_update` fields), thread-widget actions, and the full-screen-clears-air rule. See [rundowns.md](./rundowns.md#the-controller-live).
- **Displays & broadcast.** Output addressed by **display UUID**; `/preview/[uuid]` and `/air/[uuid]` render a set of overlays on a transparent 1920×1080 canvas with GSAP animations and stinger mixers, driven by SSE; `display_filter` routes one tournament to many displays. See [preview-air.md](./preview-air.md).
- **Theming.** The active tournament theme's colors become `:root` CSS variables at runtime. See [projects-system.md](./projects-system.md#theming).
- **Deployment.** A single always-on Node server (Hetzner) behind Caddy, with Neon (or self-hosted) Postgres and object-storage media. See [deployment.md](./deployment.md).

## Roadmap — real subsystems, staged for a later pass

These are **shipped features in the etalon** (`ets-react-poc`) and its Django backend, deferred from the first monolith pass but documented as intended work (source pointers in parentheses):

- **MIDI control.** Map MIDI notes (note 1–88, velocity, `trigger_type` overlay|event, `overlay_action` on/off/next/update/start) to overlay/event actions, so an operator drives the show from a hardware controller (Web MIDI API). (`apps/midi`, `components/Midi/**`)
- **Bluetooth heart-rate.** Pair BLE heart-rate straps (Web Bluetooth API) → stream readings over a WebSocket → render on heart-rate overlays (charted with chart.js). (`pages/bluetooth`, `HeartRateSocketContext`)
- **WebSocket timer.** A countdown/stopwatch synced to overlay timers over a dedicated WebSocket (start/stop/reset/resume/tick). (`ws v1/timer/`, `TimerConsumer`)
- **MRI (Marvel Rivals) live data.** The overlay connects **directly** to a proxy's draft/stats SSE streams (bypassing the ETS backend), with an operator-set **`delay` buffer** to line graphics up with delayed broadcast video; big-integer `room_id` must be preserved as a string. (`api/mri.js`, `hooks/useDraftStream`, `useMriStatsFields`)
- **ATEM camera switching.** The match **seating** (left/right team + players) drives Blackmagic ATEM camera switches. (`apps/seatings`, `atem_ip_address` in Settings)

## Deferred entirely (not in the etalon, or explicitly out)

- Scheduled / timed transitions; transition animations between overlays.
- Multi-*channel* rundowns (independent air buses).
- Multi-user concurrent editing; per-user roles/permissions; audit log.
- Tournament bracket auto-progression (advancing winners) — brackets render read-only.
- Cross-instance broadcast bus (Redis / Postgres `LISTEN`) for multi-instance deploys. See [preview-air.md](./preview-air.md#caveat-single-server-pubsub).

## When the core ships

An operator can:

1. Sign in.
2. Enter a tournament from the gallery.
3. Add players, teams, talents, sponsors.
4. Build a rundown of overlays and configure them.
5. Point OBS at the rundown's `/air/<rundownUuid>`, and run the show from the controller.
