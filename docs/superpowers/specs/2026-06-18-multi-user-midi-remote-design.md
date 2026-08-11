# Multi-User MIDI Remote — Design

**Date:** 2026-06-18
**Status:** Approved design, ready for implementation plan

## Summary

Add a multi-user collaboration layer to ETS where one user (the **owner**, e.g.
`caster1`) creates rundowns and titles, and another user (the **subscriber**,
e.g. `caster2`) acts as a remote **MIDI trigger surface** for the owner's live
show. The subscriber holds no editing rights — they build their own MIDI note
listing and, from a browser using the Web MIDI API, fire `show` / `hide` /
`update` actions on the owner's titles. Triggers flow through the existing
in-process broadcast bus and are delivered to `/air` via SSE, exactly like an
operator's AIR click today.

This work also pivots project creation: instead of a UI-created project per
user, there is **one shared Project seeded by migration**, and ownership moves
onto **rundowns**.

## Roles

- **Owner** (`caster1`) — creates rundowns + titles inside the shared project,
  runs the show from `/admin`. Approves subscribers and grants them specific
  rundowns.
- **Subscriber** (`caster2`) — no edit rights. Requests a subscription, and once
  granted a rundown, builds their own note→(title, action) listing and triggers
  it live from a MIDI controller via the browser.

Both owner (admin AIR clicks) and subscriber (MIDI) publish to the **same**
broadcast bus for a rundown.

## Supersedes existing docs

This feature reverses three decisions currently documented in `CLAUDE.md` and
`docs/projects-system.md`. They are intentionally replaced:

1. **"Projects are created from the UI via Add Project / `POST /api/projects`."**
   → Projects are no longer user-created. One project is seeded by migration.
2. **The `/admin` project gallery + Add Project button.** → Removed. `/admin`
   lands directly on the single project's workspace.
3. **"Many projects reuse one overlay package."** → Out of scope; the single
   seeded project binds one overlay package via its `label`.

Everything else in the existing docs (the `project_id` FK isolation pattern,
title `model.ts`/`settings.ts`, SSE-over-bus, Edge-only streaming) stays intact.

## Approach

**Chosen: additive layer on the existing model.** Keep all entity tables
project-scoped exactly as documented; add rundown-level ownership, a small
subscription/grant pair, and a subscriber-owned `midi_bindings` table. Reuse the
existing broadcast bus; add one authenticated trigger endpoint alongside the
public SSE stream.

**Rejected: generalized collaborators + per-project ACL/role matrix.** More
flexible, but it's a permissions framework the product doesn't need yet. The
model is specifically "owner + per-rundown MIDI remote." YAGNI.

## Data model

### Project — seeded, not user-created

- A migration inserts **one** `projects` row with a fixed `id` and `label` (the
  overlay-package folder). No `owner_id` on `projects`.
- Entity tables keep `project_id` and `/api/projects/[projectId]/...` routing
  unchanged — `projectId` always resolves to the one seeded UUID. The
  multi-tenancy pattern is untouched; it simply has one tenant.

### Ownership on rundowns (migration: new column)

```ts
// db/schema.ts — rundowns
owner_id: uuid('owner_id').notNull().references(() => users.id),
```

- Set to the creating user when a rundown is created.
- The Overlays list shows **my rundowns + rundowns granted to me**.
- Titles (`rundown_items`) inherit ownership through their rundown.

### `subscriptions` — the owner↔subscriber relationship (new table)

```
subscriptions
  id            uuid pk default random
  owner_id      uuid not null references users(id)
  subscriber_id uuid not null references users(id)
  status        enum('pending','accepted','revoked') not null default 'pending'
  created_at    timestamp not null default now()
  unique(owner_id, subscriber_id)
```

Subscriber requests → `pending`; owner accepts → `accepted`; owner can later
→ `revoked`.

### `rundown_grants` — per-rundown scope (new table)

```
rundown_grants
  id              uuid pk default random
  subscription_id uuid not null references subscriptions(id) on delete cascade
  rundown_id      uuid not null references rundowns(id) on delete cascade
  created_at      timestamp not null default now()
  unique(subscription_id, rundown_id)
```

The owner picks which of their rundowns an accepted subscriber may control.

> **Visibility vs. control.** Grants gate **control** (creating bindings + firing
> triggers), *not* visibility. Any authenticated user can **read** every user's
> rundowns and titles via the directory endpoint (below). A subscriber can only
> **bind/trigger** titles in rundowns they've been granted.

### `midi_bindings` — the subscriber's note listing (new table)

```
midi_bindings
  id              uuid pk default random
  subscriber_id   uuid not null references users(id)        -- whose listing
  rundown_id      uuid not null references rundowns(id) on delete cascade
  rundown_item_id uuid not null references rundown_items(id) on delete cascade
  action          text not null                             -- validated, not an enum (see below)
  midi_note       integer not null
  midi_channel    integer not null default 0
  label           text
  created_at      timestamp not null default now()
  unique(subscriber_id, rundown_id, midi_note, midi_channel)
```

Owned by the subscriber, scoped to a rundown. `update` re-pushes the title's
current `data` ("Live Update"). Multiple notes may target the same title with
different verbs.

> **`action` is validated text, not a Postgres enum.** Since the
> [title contract](./2026-06-21-title-contract-and-thread-widgets-design.md), a
> title **declares its own command actions** (`start`, `stop`, `reset`, …)
> alongside the universal ones. That set is dynamic per title, so it cannot be a
> fixed DDL enum. Validate `action` at **bind-time and trigger-time** against the
> bound title's declared actions —
> `['air', 'hide', 'update', ...registry[titleKey].actions]` — rejecting anything
> else with `400`. (This replaces the earlier `midi_action` enum; there is no
> `midi_action` type to create.)
>
> **`midi_channel` is the MIDI hardware channel** (0–15), unrelated to the
> broadcast `preview`/`air` channel.

### MIDI is air-only

**Bound notes fire only in the AIR environment** — a note never targets Preview.
Bindings therefore carry **no broadcast-channel column**; the trigger endpoint
always publishes on `air`. Preview remains mouse-driven from the control page.

Action → route mapping (all reuse the routes from the multi-layer design; MIDI
adds no parallel publish path):

| bound `action` | fires |
|---|---|
| `air` | `POST .../take` with `stagedItemIds: [rundownItemId]` (single-item take, full-screen rule applies) |
| `hide` | `POST .../items/[itemId]/hide-air` |
| `update` | `POST .../items/[itemId]/update` |
| any declared command (`start`, `stop`, …) | `POST .../items/[itemId]/command` with `channel: 'air'` |

### Migration scope

One migration: **create `subscriptions`, `rundown_grants`, `midi_bindings`** (with
the `subscription_status` enum only — `midi_bindings.action` is validated text,
not an enum). Workflow: edit `db/schema.ts` → `db:generate` → commit SQL →
`db:migrate` (dev then prod).

> **Superseded:** earlier drafts also seeded a single project row and added
> `rundowns.owner_id` here. The base app is **multi-project** (`/admin` gallery +
> `POST /api/projects`) and lands `owner_id` in its own schema stage — see
> `2026-06-18-base-app-scope.md`. No project seeding happens in this migration.

## API surface

All routes below are **Node runtime**, session-gated by `middleware.ts`. Scope is
derived from the **URL + session**, never the request body (consistent with the
existing `project_id` rule). Only the long-lived SSE *stream* stays Edge.

### Owner side (caster1)

| Route | Method | Purpose |
|---|---|---|
| `/api/subscriptions/incoming` | GET | List pending/accepted requests to me |
| `/api/subscriptions/[id]` | PATCH | Accept / revoke (sets `status`) |
| `/api/subscriptions/[id]/grants` | GET / PUT | List & set which of my rundowns this subscriber controls |

### Discovery (any authenticated user)

| Route | Method | Purpose |
|---|---|---|
| `/api/directory` | GET | All users → their rundowns → their titles |

Returns the full tree for browsing/subscription discovery. Read-only; **no grant
required** — this is the deliberate exception to grant-gating (see *Visibility vs.
control* above). Shape:

```jsonc
[
  {
    "userId": "…", "email": "caster1@…",
    "rundowns": [
      {
        "rundownId": "…", "name": "Finals Day",
        "titles": [
          { "rundownItemId": "…", "titleKey": "lower-third", "position": 0, "label": "…" }
        ]
      }
    ]
  }
]
```

Titles are listed by `titleKey`/`position`/`label` only — the per-instance `data`
jsonb is **not** included (it isn't needed to build a binding, and keeping it out
avoids leaking live show content). Bindings still target a title by
`rundownItemId`; the grant check applies when the binding is *created* and when
it's *triggered*, not when the directory is read.

### Subscriber side (caster2)

| Route | Method | Purpose |
|---|---|---|
| `/api/subscriptions` | POST | Request to follow an owner |
| `/api/subscriptions/mine` | GET | My subscriptions + which rundowns I'm granted |
| `/api/rundowns/[rundownId]/midi-bindings` | GET / POST | My listing for this rundown (CRUD) |
| `/api/rundowns/[rundownId]/midi-bindings/[id]` | PATCH / DELETE | Edit / remove one note binding |
| `/api/rundowns/[rundownId]/trigger` | POST | Fire one action on air |

### The load-bearing authorization check

Reused by every subscriber-scoped route:

```ts
// given session.user.id + rundownId
// 1. find rundown → require it exists
// 2. find rundown.owner_id
// 3. require an accepted subscription(owner_id, subscriber = session.user.id)
// 4. require a rundown_grant(subscription, rundownId)
// else 403
```

Binding writes additionally verify the `rundown_item_id` belongs to that
`rundownId` (can't bind to a title outside the granted show).

Owner-side routes authorize by requiring the acting user to be the `owner_id` of
the relevant subscription/rundown.

## Trigger flow (hot path)

```
caster2 browser (Web MIDI): noteon → look up local binding
  → POST /api/rundowns/[rundownId]/trigger { rundownItemId, action }
       server:
         - authz check (above)
         - validate action against ['air','hide','update', ...title's declared actions]
         - dispatch to the SAME handler the control page uses (air → single-item
           take; hide → hide-air; update → re-read + re-parse data; command →
           publish a command event), always on the 'air' channel
  → SSE → /air repaints
```

Design notes:

- **Trigger is Node, not Edge** — needs session + DB. Consistent with
  `deployment.md` (Node default; Edge only for streaming).
- **Both caster1 (admin AIR) and caster2 (MIDI) publish to the same bus**, on the
  **air** channel. Air is now a **layered set** (multi-layer design), so actions
  compose rather than overwrite: a MIDI `air` adds that item to the live set (or
  clears it first if the item is full-screen), and `hide` removes exactly one
  item. Both surfaces read the same bus snapshot, so they stay in sync.
- **Binding lookup is client-side** — the subscriber's page loads its bindings
  once, so a note press is an O(1) local map hit followed by a single authorized
  POST. Keeps live latency low.
- **Web MIDI requires HTTPS + a user gesture.** The MIDI-player page handles the
  `navigator.requestMIDIAccess()` permission prompt on load.
- **Single-server bus caveat still applies** (see `CLAUDE.md`): owner and
  subscriber must hit the same instance/region for a rundown. Unchanged by this
  feature.

## UI surface

- **`/admin` (owner)** — lands directly on the single project's workspace
  (Data / Overlays); no project gallery. Overlays list shows my rundowns +
  granted rundowns. New: a **Subscribers** view to accept/revoke requests and
  toggle per-rundown grants.
- **Subscriber MIDI-player page `/midi/[rundownId]` (subscriber-only)** —
  connects the controller, lists bindings with **note-learn** ("press a pad to
  assign"), a connection indicator, and per-row buttons for that binding's action
  (`air` / `hide` / `update` / the title's declared commands) as a no-hardware
  fallback. Subscriber-facing entry point also needs a way to
  request a subscription and see granted rundowns (`/api/subscriptions/mine`).
- **`/preview` and `/air`** — unchanged by this feature; still public, still fed
  purely by SSE (now a layered *set* per the multi-layer design, not one title).

## RTK Query / state

New API slices following the existing one-slice-per-entity convention:
`directoryApi`, `subscriptionsApi`, `rundownGrantsApi`, `midiBindingsApi`. Bindings cache tags
include `rundownId`. The MIDI-player page may read bindings via RTK Query for
editing, but the live trigger path posts directly (not through the cache) to
avoid invalidation churn during a show. `/preview` and `/air` still use no
Redux.

## Out of scope (this spec)

- Field-value MIDI payloads (e.g. "note 60 = score +1"). Actions are limited to
  `show` / `hide` / `update` of the title's existing data.
- Owner visibility into which subscriber is currently connected/triggering.
- Cross-instance bus broker (Redis / Postgres `LISTEN/NOTIFY`).
- Subscriber editing of any owner data.
- Multiple on-air titles per rundown.

## Open questions

None blocking. Revisit field-value payloads and connected-subscriber presence
post-MVP if operators ask for them.
