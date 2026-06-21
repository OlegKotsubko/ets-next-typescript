# Title Contract & Thread Widgets — Design

**Date:** 2026-06-21
**Status:** Design (pre-implementation)
**Companion to:** [`2026-06-21-multi-layer-preview-air-design.md`](./2026-06-21-multi-layer-preview-air-design.md) (the switcher) and [`2026-06-18-multi-user-midi-remote-design.md`](./2026-06-18-multi-user-midi-remote-design.md) (the MIDI surface).
**Touches:** `docs/titles-system.md`, `docs/rundowns.md`, `docs/preview-air.md`, the multi-layer spec/plan (adds a `command` event), the control page, a new top-level `models/` directory.

## Problem

The multi-layer spec defines the preview→program switcher. This spec defines the
layer beneath it: **how a title declares what the operator can edit and do**, and
how the control page renders a **widget** + per-channel **thread widgets** from
that declaration. It also defines the **action vocabulary** shared by the
thread-widget buttons and (future) MIDI bindings, so they never drift apart.

Concretely, a title like **OpeningTimer** must declare: its operator-editable
**fields** (`hours/minutes/seconds/main_text/sponsors`), its **command actions**
(`start/stop/reset`), and its **SSE payload** shape — once, reusably, so other
projects can reuse it while omitting or adding fields.

## Action vocabulary (the unifying idea)

An **action** is a named operation on one item, on one channel:

```ts
interface ActionTrigger {
  action: string;                 // 'air' | 'preview' | 'hide' | 'update' | <command>
  rundownItemId: string;
  channel: 'preview' | 'air';
}
```

Two kinds:

### Universal actions (implicit for every title)

| action | channel | maps to | effect |
|---|---|---|---|
| `air` | air | `POST .../take` with `stagedItemIds:[itemId]` | **single-item take** — show this item on air, applying the full-screen-clears-Air rule |
| `preview` | preview | `POST .../items/[itemId]/preview` | stage this item |
| `hide` | preview \| air | `DELETE .../preview` / `POST .../hide-air` | remove from that channel |
| `update` | both (UI) / air (MIDI) | `POST .../items/[itemId]/update` | resend current `data` |

Key reuse: **`air` is a single-item take.** The master AIR button takes the whole
staged set (`stagedItemIds:[...all staged]`); a per-item `air` action (thread
button or MIDI) takes exactly one item. Both go through the same `/take` route and
`computeTake`, so the full-screen rule is honored either way — no second code path.

### Command actions (declared by the title)

`start`, `stop`, `reset`, … — title-specific, published as a **`command`** event
on the target channel and handled imperatively by the title. Declared in the
title's model (below) so the thread widget knows which buttons to render and MIDI
knows which notes are bindable.

## Command events

Add a fourth variant to the broadcast event union (this is an **amendment to the
multi-layer spec/plan** — see [What changes](#what-changes-vs-existing-doc--specs)):

```ts
type BroadcastEvent =
  | { type: 'show';    itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide';    itemId: string }
  | { type: 'update';  itemId: string; layer: number; position: number; data: unknown }
  | { type: 'command'; itemId: string; action: string; payload?: unknown };   // NEW
```

- **Not snapshotted.** `applyEvent` ignores `command` (returns the snapshot map
  unchanged) — it only stores `show`/`hide`/`update`. So a `command` is relayed
  live to connected clients but **never replayed on reconnect**.
- **Fire-and-forget reload behavior** (operator's choice): on an Air/Preview
  window reload, a title's **data fields recover** (from the snapshot), but
  **command-driven state does not** (a running timer comes back stopped at its
  last `data`; the operator re-fires `start`).
- **Per channel.** A command is published to one channel only, so the Air timer
  can run independently of the Preview timer.

### Delivery to the on-screen title

`useTitleStream` reduces `show`/`hide`/`update` into the live set as before, and
**forwards `command` events to the matching on-screen title instance** via an
imperative handler the component registers:

```ts
// title component registers a handler for its declared actions
function OpeningTimer({ data, onCommand }: TitleProps<OpeningTimerData>) {
  onCommand((action /*, payload */) => {
    if (action === 'start') startTicking();
    if (action === 'stop')  stopTicking();
    if (action === 'reset') resetTo(data);
  });
  // …render…
}
```

`TitleRenderer` wires each rendered component's `onCommand` to the command stream
filtered by `itemId`.

### Command route

```
POST /api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/command
body: { action: string, channel: 'preview' | 'air', payload?: unknown }
```

The handler loads the item, looks up the title's **declared command actions** via
the registry, **rejects an action the title didn't declare** (400), then
`publish(rundownId, channel, { type: 'command', itemId, action, payload })`.

## Title declaration — shared models + per-title files

A new top-level **`models/`** library holds reusable title contracts; each
package's title files compose from it. The existing three-file rule
(`index.tsx` / `model.ts` / `settings.ts` inside `projects/<label>/titles/<key>/`)
stays — the shared model sits underneath.

### `models/<TitleType>.ts` — the reusable contract

```ts
// models/OpeningTimer.ts
import { z } from 'zod';

export const OpeningTimerFields = z.object({
  hours:     z.number().int().min(0).max(99),
  minutes:   z.number().int().min(0).max(59),
  seconds:   z.number().int().min(0).max(59),
  main_text: z.string().max(80),
  sponsors:  z.array(z.string()).default([]),
});

export const OpeningTimerActions = ['start', 'stop', 'reset'] as const;
```

Declares the **fields** (data schema = widget form + SSE `data` shape) and the
**command actions** (thread-widget buttons + bindable). One canonical description.

### `projects/<label>/titles/<key>/model.ts` — compose & customize

```ts
// projects/super-test/titles/opening-timer/model.ts
import { z } from 'zod';
import { OpeningTimerFields, OpeningTimerActions } from '@/models/OpeningTimer';

// this project omits sponsors and adds a subtitle
export const model = OpeningTimerFields.omit({ sponsors: true }).extend({
  subtitle: z.string().max(60).optional(),
});
export const actions = OpeningTimerActions;          // or a customized subset
export type Data = z.infer<typeof model>;
```

This is how "OpeningTimer is almost the same across projects — skip some fields,
add some" works: import the shared fields, `.omit()`/`.extend()` per project.

### `settings.ts` — imports the model, adds presentation

```ts
// projects/super-test/titles/opening-timer/settings.ts
import { model, actions } from './model';

export const settings = {
  title_name: 'Opening Timer',
  title_is_full_screen: true,
  title_stinger_in: 'timer-in.webm',
  title_stinger_out: 'timer-out.webm',
  model,        // widget field validation (operator inputs)
  actions,      // thread-widget command buttons
};
```

Reading `settings.ts` when adding a title to a rundown yields the **full title
entity**: presentation + field validation + command actions. The registry exposes
`getTitleRegistry(projectId)[titleKey]` → `{ Component, model, settings, actions }`.

### `index.tsx` — render `data`, handle commands

The component is a function of `data` (as today) **plus** an `onCommand`
registration for its declared actions (sketch above).

## Control page anatomy

### Widget — left "Templates" list (one per rundown item)

- **Expand/collapse button** (the pencil in the screenshots) opens the **data-field
  form**, generated from `settings.model`.
- A **player/entity picker** is a field type that references a project entity
  (e.g. the PlayerScore "Players: Kash Forge" dropdown is a reference into the
  project's `players`). Modeled as a field whose options come from a project query.
- **UPDATE** button → `update` action → resends current `data` to **both** the
  Preview and Air channels for that item (so an edit reflects live and in preview).
- **Validation badges** (the red "Please choose the match") come from the model's
  required fields failing validation — the item can't go to air until satisfied.

### Thread widget — center column (one per channel)

For a title that is **staged**, a Preview thread widget renders **above** HIDE/AIR;
for one that is **live**, an Air thread widget renders **below**. A title that is
both shows **two** thread widgets (and two render panels — Preview top, Air bottom,
per the screenshot). Each thread widget shows `layer ● name`, the title's
**command buttons** (`start/stop/reset`), and a remove-from-this-channel control.
Clicking a command fires the `command` action on that widget's channel.

The center **AIR** button is the master take (stage→air); **HIDE** clears preview.
Per-item air/hide live on the thread widgets and item rows.

## MIDI integration (future-facing)

MIDI is the live surface, so **bound notes fire only in the AIR environment** — a
note never targets Preview. Therefore a binding needs no channel; channel is
implicitly `air`:

```
noteon → local binding { rundownItemId, action } → trigger on the AIR channel
```

- Bindable actions = the universal set on air (`air`, `hide`, `update`) **plus**
  the title's declared command actions (`start`, `stop`, `reset`).
- Because command actions are **dynamic per title**, the MIDI spec's fixed
  `midi_action` Postgres enum (`show|hide|update`) must become a **validated text
  `action`** column, checked against the bound title's declared action list at
  bind-time and trigger-time. This is the required amendment to
  `2026-06-18-multi-user-midi-remote-design.md` when that work lands.
- Reuse the same routes: MIDI `air` → single-item `/take`; `hide` → `/hide-air`;
  `update` → `/update`; commands → `/command` with `channel:'air'`.

## What changes vs. existing docs & specs

- **`docs/titles-system.md`** — `model.ts` may compose from a shared `models/`
  contract; titles declare **command actions**; document the `models/` layer and
  the entity-reference field type.
- **Multi-layer spec & plan** (`2026-06-21-multi-layer-preview-air`) — add the
  `command` event variant; `applyEvent` ignores `command` (no snapshot change);
  add the `/command` route and an `/update` route; the `air` action is a
  single-item `/take`.
- **`docs/rundowns.md` / `docs/preview-air.md`** — document widget vs. thread
  widget, the per-channel command flow, and UPDATE-to-both-channels.
- **MIDI spec** (`2026-06-18-multi-user-midi-remote`) — `midi_action` enum →
  validated text action; bindings are **air-only**; bindable set includes title
  command actions.

## Constraints carried forward

- **Reload recovery is data-only.** Snapshot restores `data`; fire-and-forget
  commands are not restored (accepted limitation).
- **Single-server in-memory bus** (from the multi-layer spec) is unchanged.
- Server derives `projectId`/`rundownId`/`itemId` from the URL; the command
  route validates `action` against the title's declared actions, never trusting an
  arbitrary string.

## Out of scope (this design)

- Building the MIDI feature itself (separate plan); this only fixes the action
  vocabulary it will consume and the air-only rule.
- Per-channel MIDI (MIDI is air-only by decision).
- Restoring command/timer state across reloads (fire-and-forget).
- A generic visual builder for `models/`; models are authored in code.

## Open questions

- **Entity-reference field type** (the player picker): exact declaration form — a
  branded Zod field (e.g. `entityRef('players')`) vs. a field-metadata sidecar.
  Resolve when writing the titles-system update; the PlayerScore example is the
  driver.
- Whether `reset`-class commands should also be expressible as an `update` to
  initial `data` (so they survive reload) — left to the title author per command.
