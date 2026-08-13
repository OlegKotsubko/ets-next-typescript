# Roadmap

## MVP — what we are building

The MVP scope is everything described in the rest of the docs. Specifically:

- **Authentication.** Email + password login via better-auth; no public sign-up. See [auth.md](./auth.md).
- **Project gallery + Add Project.** `/projects` lists projects (DB rows) as a grid and has an **Add Project** button: a dialog with `project_name`, `project_mode` (`team_vs_team` / `player_vs_player`), `project_picture`, `project_label` (dropdown of overlay-package folders under `projects/`), `project_date`. See [projects-system.md](./projects-system.md#creating-a-project-operator).
- **Project workspace.** Two links: **Data** and **Overlays**. (MIDI/Bluetooth are no longer in the primary nav; still sketched below.)
- **Data CRUD.** Project Assets, Players, Talents, Teams (with the `team_players` join + captain/stand-in flags), Sponsors, Project CSS, Project Videos, Tournament Brackets. Players/Talents/bracket matches carry an open `extra` string-map. See [data-entities.md](./data-entities.md).
- **Brackets.** Single-elimination generated from a participant count (8 → 4 Quarterfinal + 2 Semifinal + 1 Final); matches pair teams or players per `project_mode`. Read-only in overlays.
- **Overlays (rundowns).** Create overlays, add overlay components, configure each via the Zod-driven form, reorder, delete. Each overlay component ships a `settings.ts` (preview, stingers, color, background/video, full-screen splash). See [rundowns.md](./rundowns.md) and [titles-system.md](./titles-system.md).
- **Controller.** HIDE / AIR per item; in-process broadcast event bus; per-rundown SSE channels for `preview` and `air`. See [rundowns.md](./rundowns.md) and [preview-air.md](./preview-air.md).
- **Broadcast render targets.** `/preview/[rundownId]` and `/air/[rundownId]` as OBS/vMix browser sources, with per-project CSS and self-hosted fonts. See [preview-air.md](./preview-air.md) and [projects-system.md](./projects-system.md).
- **Deployment.** Netlify (Production / Deploy Preview / Branch Deploys) with Neon database branching, Edge runtime for SSE. See [deployment.md](./deployment.md).

## Out of MVP (Beta — sketched, not built)

These are no longer in the primary workspace nav (which is just **Data** and **Overlays**); they remain sketched here for a later iteration. No functionality ships in MVP.

### MIDI (Beta)

**Goal.** Let the operator drive HIDE / AIR / SELECT from a hardware MIDI controller (e.g., a Stream Deck, Akai APC, Behringer X-Touch). Each rundown item is bound to a pad/button; pressing the pad triggers the same Route Handlers the on-screen controller hits today.

**Sketch.** A small client-side service uses the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) (already in Chrome/Edge) to subscribe to MIDI input events. A "MIDI mappings" admin screen lets the operator bind notes/CCs to rundown items. Mappings are stored per-project (`midi_mappings` table) and roundtripped via RTK Query like any other entity.

**Why not MVP.** Hardware integration adds enough complexity (device permissions, mapping UI, conflict resolution) that it deserves its own iteration after the rest is stable.

### Bluetooth (Beta)

**Goal.** Let presenters carry a small Bluetooth remote (a clicker) that pages through a per-presenter rundown — useful for keynote-style events.

**Sketch.** Uses the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) to pair a HID device, listen for input characteristic notifications, and dispatch AIR / HIDE actions. Same Route Handlers as the on-screen controller.

**Why not MVP.** Web Bluetooth is browser-locked (Chrome/Edge only, requires user gesture, no Safari support). Worth waiting for either broader support or a clear request from the user base.

## Out of MVP entirely (not even sketched)

Features we've consciously deferred:

- **Scheduled transitions** (auto-advance a title after N seconds).
- **Animation between titles** (the Screenshot 6 "Transition" dropdown is a placeholder — no transitions in MVP).
- **Multiple simultaneous AIR layers** per rundown (e.g., a persistent ticker plus an overlapping lower-third). MVP supports one on-air title at a time.
- **Multi-user concurrent editing** (operator A and operator B editing the same rundown at once). MVP assumes one operator.
- **Per-user permissions / roles.** All authenticated users have full access.
- **Audit log** of who did what.
- **Tournament bracket auto-progression** (advance winners through rounds). Brackets are read-only in MVP titles.
- **Asset upload via signed URLs** is documented as a "decide before build" item in [data-entities.md](./data-entities.md#upload-strategy--decide-before-build).
- **Cross-instance broadcast bus** (Redis / Postgres LISTEN) for multi-server deployments. MVP assumes a single Edge region per rundown. See [rundowns.md](./rundowns.md#caveat-single-server-pubsub).

## When MVP ships

The MVP is complete when an operator can:

1. Sign in.
2. Create a project (pick an overlay package via `project_label`), then open it.
3. Add a Player, a Talent, a Team, and a Sponsor.
4. Create an overlay (rundown), add three overlay components, configure them.
5. Point OBS at `/air/<rundownId>`, run the show by clicking AIR / HIDE.

Everything beyond that is post-MVP iteration.
