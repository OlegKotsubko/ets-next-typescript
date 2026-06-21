# Multi-Layer Preview → Air — Design

**Date:** 2026-06-21
**Status:** Design (pre-implementation)
**Touches:** `docs/preview-air.md`, `docs/rundowns.md`, `docs/roadmap.md`, `docs/state-management.md`, `db/schema.ts`, the broadcast renderer, the rundown editor/controller, broadcast API routes.

## Problem

The current model (`docs/rundowns.md`, `docs/preview-air.md`) supports **one on-air
title per rundown**. AIRing a title replaces whatever was live; `roadmap.md` lists
"multi-channel rundowns" as out of MVP.

Operators need to run **several overlays live at once** (e.g. a lower-third over a
scoreboard) and to **stage a composition before taking it to air** — a
preview→program switcher, like vMix/ATEM. They also need **full-screen splash
titles** (intermission, "starting soon", full-screen replay) to behave specially:
taking a full-screen title should wipe the stage so it lands clean.

### Motivating example

A full-screen title is live on Air. The operator stages a *different* full-screen
title in Preview and presses AIR. Expected: the live full-screen title hides
automatically and the staged one appears on Air. This falls out of the general
rules below rather than being special-cased.

## Model

Replace the single-selected-item controller with **two composition buses per
rundown**, both keyed by `itemId`, both transient (in-memory, never persisted):

| Bus | Driven by | Rendered on | Holds |
|---|---|---|---|
| **Preview set** | each widget's Preview/Hide toggle | `/preview/[rundownId]` | staged composition (ordered) |
| **Air set** | master AIR (take) + per-widget Hide Air | `/air/[rundownId]` | live composition (ordered) |

The SSE `preview` and `air` channels each now render a **set of titles**, not a
single `current`.

## Rules (load-bearing logic)

1. **Toggle Preview on a widget** → add/remove it from the Preview set → emit
   `show`/`hide` on the **preview** channel for that `itemId`.
2. **AIR (the take)** → fold the Preview set into the Air set, **additive
   (union)**. Items already live stay live; the Preview set is **left untouched**
   (stays staged — workflow B: stage → take → keep staged).
3. **Full-screen exception (asymmetric).** If *any* staged item being taken is
   full-screen (`settings.title_is_full_screen === true`), the take **first hides
   every item currently on Air**, then shows the staged set. A take with only
   non-full-screen items just stacks onto the existing Air set. The exception
   fires on the **incoming** title only — once a full-screen is live, later AIRing
   a non-full-screen stacks on top of it normally.
4. **Hide Air on a widget** → remove that one item from the Air set → `hide` on
   the **air** channel. (A "Clear all / panic" control is a sensible fast-follow
   but is **not** in this design's scope.)
5. **Edit data while live** → `update` on the relevant channel(s) (existing
   "edit while on AIR" behavior, now per-item).

The motivating example resolves via rules 2+3: full-screen live, stage a new
full-screen, AIR → incoming full-screen triggers rule 3 → Air cleared → staged
full-screen shown.

## Z-order: explicit `layer`

Stacking is **not** derived from AIR order — it is an explicit per-item field
already present in the UI as the **"Layer"** dropdown in the Add Template modal
(see `screenshots/Screenshot 2026-06-13 at 13.27.50.png`, "Layer: 1").

- **New column `rundown_items.layer`** — `integer not null default 0`,
  constrained `0–10`. This is structural metadata like `position`/`label`,
  **not** title `data`, so it is a real column, **not** JSONB.
  → **Requires a migration** (edit `db/schema.ts` → `db:generate` → commit the
  SQL → `db:migrate` against dev then prod). Per CLAUDE.md, adding a column is a
  DDL change.
- **Render order = `layer`, higher on top** (layer 10 renders above layer 0).
  **Tiebreak by `position`** when two live items share a layer.
- **`layer` and `position` ride in the `show`/`update` SSE payload** (alongside
  `titleKey` and `data`) so the renderer can sort by `(layer, position)` and
  assign `z-index` without a DB read. These are the only new fields on the event
  shape.
- **Full-screen interaction:** full-screen still triggers the clear-Air-on-take
  rule (rule 3), but its on-screen stacking honors its own `layer` like any other
  title — no z-order special-casing in the renderer. An operator sets a
  full-screen splash to a high `layer` to sit over a stacked lower-third, or low
  to sit behind. Their choice.

## Architecture — keep the bus dumb

Preserve the existing philosophy: **the bus is a dumb relay; on-air state is
transient and client-side** (`docs/rundowns.md` "broadcast event bus",
`docs/preview-air.md`).

### Conductor: the admin control page

The rundown editor holds the two compositions in the **`editor` Redux slice**
(ephemeral UI state — exactly its purpose, per `docs/state-management.md`):

```ts
// store/slices/editorSlice.ts — replaces single onAirItemId / selectedItemId model
interface EditorState {
  previewSet: string[];   // staged itemIds, ordered
  airSet: string[];       // live itemIds, ordered
  // selectedItemId stays for the settings form
}
```

`onAirItemId: string | null` (the old single-highlight mirror) is replaced by
`airSet: string[]`. The list UI highlights every `itemId` in `airSet`, and marks
every `itemId` in `previewSet`.

### The rule lives server-side, computed once, in a take endpoint

The full-screen-clears-Air rule is computed **once, on the server**, not in each
renderer:

```
POST /api/projects/[projectId]/rundowns/[rundownId]/take
body: { stagedItemIds: string[], liveItemIds: string[] }
```

The handler:
1. Loads the staged items; looks up each title's `settings.title_is_full_screen`
   via the title registry.
2. If any staged item is full-screen → emit `hide` on the **air** channel for
   every `liveItemId`.
3. Emit `show` on the **air** channel for every staged item (carrying
   `titleKey`, `layer`, validated `data`).
4. Returns the **new Air set** (the authoritative list of live itemIds) so the
   admin updates `editor.airSet` from the response rather than guessing.

`liveItemIds` comes from the conductor's own `airSet`; since on-air state is
transient and client-owned, the client is already the source of truth for it and
simply reports it to the server for the computation.

Supporting endpoints (per-item, mirror the existing `/air` route style):

```
POST   /api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/preview   → show on preview channel, add to previewSet
DELETE /api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/preview   → hide on preview channel, remove from previewSet
POST   /api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/hide-air   → hide on air channel, remove from airSet
```

### Bus & event shape

The bus stays unchanged in topology. The event shape gains only `layer`:

```ts
type BroadcastEvent =
  | { type: 'show';   rundownId: string; itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide';   rundownId: string; itemId: string }
  | { type: 'update'; rundownId: string; itemId: string; layer: number; position: number; data: unknown };
```

Events are already keyed by `itemId`; multi-layer needs no new event *types*.

### Renderers become a set-reducer

`useTitleStream` returns a **set**, not a single `current`:

```ts
export type LiveTitle = { itemId: string; titleKey: string; layer: number; position: number; data: unknown };

// reducer over a Map<itemId, LiveTitle>:
//   show   → set/replace entry
//   hide   → delete entry
//   update → merge data + layer
// returns entries sorted by (layer asc, position asc) for stable z-order
export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[];
```

`TitleRenderer` maps over the array, rendering each title with its `settings`
(stinger/background, full-bleed when `title_is_full_screen`) and `style={{ zIndex: layer }}`.
**No full-screen exclusivity logic in the renderer** — the conductor already
emitted the correct hides; the renderer just draws whatever set it's told to.

## Data flow (end to end)

```
Operator toggles Preview on item A
  → POST .../items/A/preview
  → bus.publish({ show, channel: preview, itemId: A, layer, data })
  → /preview EventSource → reducer adds A → renders A
  → admin marks A previewed

Operator toggles Preview on item B (full-screen), then presses AIR
  → POST .../take { stagedItemIds: [A, B], liveItemIds: [X] }
  → server: B is full-screen → hide X on air; show A, show B on air
  → /air EventSource → reducer: delete X, add A, add B → renders {A,B} by layer
  → response { airSet: [A, B] } → admin sets editor.airSet = [A, B]
  → Preview set unchanged (A, B still staged)
```

## What changes vs. the current docs

- `docs/rundowns.md` — "Controller behavior" table and "broadcast event bus" /
  "one on-air title at a time" statements rewritten for multi-layer + the two
  buses + the take endpoint. The `rundown_items` schema gains `layer`.
- `docs/preview-air.md` — `useTitleStream`/`TitleRenderer` sketches updated to the
  set model; the "Preview vs Air channels" section updated (preview = staging set,
  air = live set; AIR no longer mirrors to the preview channel — Preview is its
  own composed bus).
- `docs/state-management.md` — `editor` slice gains `previewSet`/`airSet`,
  replacing `onAirItemId`.
- `docs/roadmap.md` — move "multi on-air titles per rundown" out of the
  out-of-scope list (the full multi-*channel* MIDI routing work can stay future).
- `docs/database.md` — note the `rundown_items.layer` column + its migration.

## Constraints carried forward

- **Single-server pub/sub caveat** still applies (`docs/rundowns.md`). The two
  compositions are transient and client-held; an admin tab refresh loses
  `previewSet`/`airSet` (the renderers keep drawing what they last received, but
  the conductor can no longer issue correct per-item hides until re-composed).
  Acceptable for MVP; documented. A future snapshot-on-connect mechanism would
  fix late-joiner and refresh gaps but is out of scope.
- **Edge runtime** for SSE streaming routes only; the take/preview/hide-air route
  handlers run on Node (registry + DB access), like the existing `/air` route.

## Out of scope (this design)

- "Clear all / panic" control (fast-follow).
- Snapshot-on-connect / state replay for late-joining OBS sources or admin
  refresh recovery.
- Transition animations between stacked titles; timed/scheduled takes.
- Multi-*channel* rundowns (separate independent AIR buses); this design is a
  single Air set with z-layering, not multiple channels.

## Open questions

None blocking. Confirm during planning: whether the "Layer" dropdown enumerates
0–10 discretely (UI) and whether layer is editable post-add (assumed yes, via the
item settings form).
