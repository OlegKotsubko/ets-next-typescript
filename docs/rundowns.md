# Rundowns (the Overlays section)

> **This is the "Overlays" workspace section.** A rundown is an operator's ordered list of **overlays** (titles) for a broadcast; the editor builds the list and the **controller** drives it live. Tables: `rundowns`, `rundown_overlays`, `rundown_overlay_data` (see [database.md](./database.md#5-rundowns--overlays--overlay-data)). The graphics themselves are the global overlay components — see [titles-system.md](./titles-system.md).

## Data model

Three tables (full column lists in [database.md](./database.md#5-rundowns--overlays--overlay-data)):

- **`rundowns`** — `{ id, project_id, user_id, name, image }`.
- **`rundown_overlays`** — a placed overlay instance: `model` (kebab registry key), `category`/`template`, `widget_name`, `layer` (1–7), `color` (1–7), `display_filter` (`''`|`1`–`10`), `is_fullscreen`, `has_next_button`, `order`, `preview_img`, the stinger **mixers** (`in_mixer`/`out_mixer`/`inner_mixer` + cut points), and `background_video`/`background_image`.
- **`rundown_overlay_data`** — per `(overlay, display, user)`: `{ data: { widget: {…}, …collected }, is_preview, is_air }`. The operator's edited field values live in `data.widget`; the rest is the render payload assembled server-side (current match, participants, sponsors).

`project_id` is denormalized onto `rundown_overlays` so items can be filtered by tournament without joining through `rundowns`.

> **Current state (overlays pass).** The **editor** stores authored widget values **inline** on `rundown_overlays.data.widget`; there is no `rundown_overlay_data` or `display` yet. The controller and the per-display `rundown_overlay_data` (with `is_preview`/`is_air`) are built in the **broadcast pass**, which seeds each display's copy from the authored default. The overlay components, the build-time registry ([titles-system.md](./titles-system.md)), and the editor described below are live — the editor is a **master-detail two-pane** screen (left: overlay listing with preview thumbnails + a color filter; right: a template grid to add or a properties form to configure the selected overlay), reachable by clicking a rundown card in the list. The **controller** section below is the target design, not yet built.

## Why overlay config is JSONB

Overlay field shapes vary wildly (a lower-third vs. a scoreboard vs. a bracket), and there are hundreds of overlays. A table per overlay type would force a migration for every new overlay. Instead, each overlay declares a **widget schema** (its operator-editable fields — `input_type`, `choices`, `default`, `required`, `can_live_update`; see [titles-system.md](./titles-system.md#modelts--the-widget-schema)), and the operator's values land in `rundown_overlay_data.data.widget`, validated against that schema at the API boundary. Adding or editing an overlay needs **no migration**.

## Creating a rundown

From `/projects/[projectId]/rundowns`: **Add rundown** → name it → `POST /api/projects/[projectId]/rundowns` `{ name }` → navigate to the editor at `/projects/[projectId]/rundowns/[rundownId]`.

## The overlay editor

At `/projects/[projectId]/rundowns/[rundownId]` the operator **builds** the rundown:

- **Add an overlay** — pick from the overlays available to the tournament's discipline plus the cross-discipline `general` set (see [projects-system.md](./projects-system.md#which-overlays-a-tournament-can-use)). Set its `widget_name`, `layer`, `color`, `display_filter`, `is_fullscreen`.
- **Configure it** — a form generated from the overlay's widget schema (generic `DefaultWidget`, or one of ~50 bespoke forms via a `CustomWidgetFormSwitcher` in the etalon; React Hook Form + `zodResolver` in the monolith). Fields flagged `can_live_update` can be changed while the overlay is on air.
- **Reorder / remove** — drag to reorder (`order`), delete to remove. `POST …/rundown-overlays/reorder` `{ rundown_overlay_ids: [...] }` rewrites `order`.

## The controller (live)

At `/projects/[projectId]/rundowns/[rundownId]/controller` the operator drives the show. The etalon layout (`Controller.js`) is a scaled grid of: **ControllerListing** (the rundown's overlays), **ControllerThread** (thread-widget action buttons), **ControllerPreview** and **ControllerAir** (the two live renders), **ControllerMatch** (the selected match), and a **ControllerSidebar**.

The switcher is **preview → air**, a composition of many overlays (not one-at-a-time):

| Action | Route | Effect |
|---|---|---|
| **Stage** an overlay to preview | `POST /{model}/{id}/preview` | Validates `data.widget`, collects render data, publishes `preview` on that display's preview channel. |
| **Take** to air | `POST /events/air` (per-item: single-item take) | Publishes `air` for the staged overlay(s); a full-screen take first hides the current air set. |
| **Hide** | `POST /events/{id}/hide` `{ hide_from: ['preview'\|'air'] }` | Publishes `hide` on the named channel(s). |
| **Hide all** | `POST /events/hide_all` | Bulk-hides a display. |
| **Live-update** while on air | `POST /{model}/{id}/live-update` | Sends only `can_live_update` fields; publishes `live_update` (merged by id). Field errors return as `field_mapping[]` → surfaced on the form. |
| **Thread-widget action** | `POST /events/{id}/event` `{ event, display_type?, data? }` | Fires a declared overlay action (e.g. a timer's `start`/`stop`/`reset`, or `next`). |

Overlays carry an explicit **`layer` (1–7)** for z-order and a **`display_filter`** so a take routes only to the displays that match. See [preview-air.md](./preview-air.md) for the SSE side and the full-screen-clears-air rule.

## Edit-while-on-air

Operators expect to tweak text mid-show (as in vMix/Wirecast). A field's **`can_live_update`** flag gates this: editing such a field while the overlay is on air sends a `live_update` (not a full re-take), and the on-air render merges the new `data.widget` in place without replaying the enter animation.

## Roadmap

Scheduled / timed transitions, transition animations between overlays, and multi-*channel* rundowns (independent air buses) are not in the core. Real subsystems that hang off the controller — **MIDI** triggers, **thread widgets** at scale, **ATEM** camera switching via seating — are documented in [roadmap.md](./roadmap.md).
