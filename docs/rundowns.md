# Rundowns

> **This is the "Overlays" section.** In the workspace nav the operator sees **Data** and **Overlays**; "Overlays" is this rundown system (it replaced the old "Rundowns" tab, and the MIDI/Bluetooth Beta tabs are no longer in the primary nav). The data model and tables keep the `rundowns` / `rundown_items` names. The graphics an overlay renders are the overlay components (formerly "titles") from the project's package — see [titles-system.md](./titles-system.md).

A **rundown** is an ordered list of overlay instances the operator drives during a live broadcast. The editor is the operator's primary interface during a show: a sidebar of available overlays, a center area with the controller (HIDE/AIR), and a live preview.

## Data model

Two tables.

```ts
export const rundowns = pgTable('rundowns', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('rundowns_project_idx').on(t.projectId) }));

export const rundownItems = pgTable('rundown_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  rundownId: uuid('rundown_id').notNull().references(() => rundowns.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  titleKey: text('title_key').notNull(),                                // folder name under projects/<slug>/titles/
  position: integer('position').notNull(),                              // order within the rundown
  label: text('label'),                                                 // operator-facing label ('HOP' in Screenshot 6)
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),       // validated by title's model.ts
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byRundown: index('rundown_items_rundown_idx').on(t.rundownId, t.position) }));
```

Why `project_id` is duplicated on `rundown_items` even though `rundowns.project_id` already exists: it lets us filter `rundown_items` by `project_id` directly (e.g., for "all items across all rundowns in this project") without joining through `rundowns`. The FK with `ON DELETE CASCADE` keeps it consistent.

## Why `data` is JSONB

Title shapes vary — a lower-third has different fields than a scoreboard than a bracket. We don't want a table per title type (that would force a migration every time a developer adds a new title — see [database.md](./database.md#migrations-vs-project-creation-vs-overlay-packages)).

Instead, the operator's configured values land in `rundown_items.data`, validated at the API boundary against the title's `model.ts` Zod schema. As shipped in P5a (`app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts`):

```ts
// loadItemsContext verifies the session + that the rundown belongs to the
// project, and returns the project's package label (never the UUID).
const ctx = await loadItemsContext(req, projectId, rundownId);
if (ctx instanceof Response) return ctx;

const model = getTitleModel(ctx.packageLabel, parsed.data.titleKey);
if (!model) return Response.json({ error: 'unknown titleKey' }, { status: 400 });

const dataParsed = model.safeParse(parsed.data.data);                     // safeParse, not throw
if (!dataParsed.success) return Response.json(dataParsed.error.flatten(), { status: 400 });

// position is server-assigned (max in rundown + 1), never taken from the body
const [row] = await db.insert(rundownItems).values({
  rundownId, projectId, titleKey: parsed.data.titleKey,
  label: parsed.data.label ?? null, position, data: dataParsed.data,
}).returning();
```

The admin **data form is generated from the same `model.ts`, not hand-written**:
`describeModel` (`lib/titles/describeModel.ts`) serializes the Zod schema to
plain-JSON field descriptors served by `GET /api/projects/[projectId]/titles`;
`TitleDataForm` renders inputs from those descriptors and a server 400's
`fieldErrors` map back onto the fields as badges. The client never holds the Zod
schema — the route above is the single validation authority.

See [titles-system.md](./titles-system.md) for the title registry.

## Creating a rundown

From `/projects/[projectId]/overlays` (Screenshot 4):

1. Operator clicks **ADD NEW RUNDOWN**.
2. A modal asks for a name (Screenshot 6's "Display name" field).
3. POST to `/api/projects/[projectId]/rundowns` with `{ name }`.
4. On success, the UI navigates to `/projects/[projectId]/overlays/[rundownId]`.

The template-selection modal (Screenshot 5) is the **Add Title** flow described next — there are no rundown-level templates in MVP.

## The rundown editor

Visible at `/projects/[projectId]/overlays/[rundownId]`. Layout (matches Screenshots 8–12):

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  [Project name]   New Rundown 1                  Preview ◯  │
├──────────────┬────────────────────────────────┬─────────────────┤
│              │                                │                  │
│  Titles      │                                │  Live preview    │
│  ──────      │   Selected title's settings    │  (renders the    │
│  ▣ Lower3rd  │   (Zod-driven form derived     │   on-air title   │
│  ▣ Score     │    from model.ts)              │   in real time)  │
│  ◇ Bracket   │                                │                  │
│  ◇ Player    │                                │                  │
│  …           │                                │                  │
│              │                                │                  │
│  + ADD TITLE │   [ HIDE ] [ AIR ]             │                  │
└──────────────┴────────────────────────────────┴─────────────────┘
```

### Left panel — Titles list

Each rundown item is listed with:
- A visibility eye icon (toggles whether the item is selectable from the controller).
- The title's `meta.displayName` (or the `label` if set).
- A drag handle for reordering (changes `position`).

Clicking an item selects it and reveals its settings in the center panel.

### Center panel — Settings + controller

The form fields are generated from the selected title's `model.ts` schema. Required fields show with their MUI input type, optional fields collapse behind a "More settings" toggle (matches Screenshot 7's expanded section).

Below the form sit the **HIDE** and **AIR** buttons:

- **AIR** dispatches a `show` event for this title to the broadcast event bus (see below). The on-air page (`/air/<rundownId>`) renders the title with the current `data`, playing the overlay's `title_stinger_in` and showing its `title_background` / `title_video` bed (or a full-screen splash if `title_is_full_screen`) — these come from the overlay's `settings.ts`, read from the registry, not the SSE payload. See [titles-system.md](./titles-system.md#settingsts--presentation-settings) and [preview-air.md](./preview-air.md#applying-overlay-settings).
- **HIDE** dispatches a `hide` event. The on-air page plays `title_stinger_out`, then clears its current title.
- The currently-on-air item is highlighted in the titles list (orange/yellow accent in Screenshots 8–12).

### Right panel — Live preview

A small iframe (or inline render) showing what's currently on AIR for this rundown. Subscribes to the same SSE stream as `/preview/<rundownId>`. See [preview-air.md](./preview-air.md).

## The broadcast event bus

Triggering AIR is an in-process pub/sub. It does **not** write to the database — the on-air state is transient and lives only for the duration of the show.

```ts
// lib/broadcast/bus.ts
type BroadcastEvent =
  | { type: 'show'; rundownId: string; titleKey: string; itemId: string; data: unknown }
  | { type: 'hide'; rundownId: string; itemId: string }
  | { type: 'update'; rundownId: string; itemId: string; data: unknown };

type Subscriber = (event: BroadcastEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();  // keyed by rundownId

export function subscribe(rundownId: string, fn: Subscriber) {
  if (!subscribers.has(rundownId)) subscribers.set(rundownId, new Set());
  subscribers.get(rundownId)!.add(fn);
  return () => subscribers.get(rundownId)!.delete(fn);
}

export function publish(event: BroadcastEvent) {
  subscribers.get(event.rundownId)?.forEach(fn => fn(event));
}
```

The AIR button calls a Route Handler that publishes the event:

```ts
// app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/air/route.ts
export async function POST(_req, { params }) {
  await requireSession();
  const item = await db.query.rundownItems.findFirst({
    where: and(eq(rundownItems.id, params.itemId), eq(rundownItems.rundownId, params.rundownId)),
  });
  if (!item) return new Response('Not found', { status: 404 });

  publish({
    type: 'show',
    rundownId: params.rundownId,
    itemId: item.id,
    titleKey: item.titleKey,
    data: item.data,
  });
  return new Response(null, { status: 204 });
}
```

The matching SSE endpoint subscribes to the bus and forwards events to its client:

```ts
// app/api/broadcast/[rundownId]/stream/route.ts
export const runtime = 'edge';

export async function GET(_req, { params }) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const unsubscribe = subscribe(params.rundownId, (event) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      // heartbeat every 15s so intermediaries don't close the connection
      const beat = setInterval(() => controller.enqueue(enc.encode(': beat\n\n')), 15000);
      return () => { clearInterval(beat); unsubscribe(); };
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
  });
}
```

See [preview-air.md](./preview-air.md) for the full SSE contract, including the difference between Preview and Air channels, and the OBS/vMix setup steps.

### Caveat: single-server pub/sub

The bus above lives in process memory. On a single-server deployment (Netlify Edge handles each rundown on one instance, since SSE keeps the connection alive) this is fine: the AIR Route Handler hits the same instance as the SSE subscribers because **the operator's admin tab and the OBS browser source connect to the same Edge region**.

**However:** if a future deployment scales to multiple instances, you'd need a cross-instance broker (Redis pub/sub, Postgres `LISTEN/NOTIFY`, etc.). Document this constraint now and revisit if the scaling shape changes. Out of MVP scope.

## Reordering and removing items

- **Reorder**: PUT `/api/projects/[projectId]/rundowns/[rundownId]/items/order` with `{ orderedIds: string[] }` (shipped shape). The server verifies `orderedIds` is the rundown's exact item set, then rewrites `position` to match the array order.
- **Remove**: DELETE `/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]`. If the removed item is currently on AIR, also publish a `hide` event for it (the `hide`-on-AIR publish is P5b — the DELETE route itself shipped in P5a).

## Controller behavior

The center panel's HIDE/AIR controls:

| Action | Result on `/preview/[rundownId]` | Result on `/air/[rundownId]` |
|---|---|---|
| Click an item in the list | Renders that item (operator preview) | No change — only AIR pushes to on-air |
| Click AIR on the selected item | Renders that item | Renders that item |
| Click HIDE | Clears the preview render | Clears the on-air render |
| Edit an item's data while it's on AIR | The preview updates | The on-air **also** updates (via `update` event) |

The "edit while on AIR" behavior matches how vMix/Wirecast operate — operators expect to tweak text on-the-fly during the show.

## What's out of MVP

- **Scheduled / timed transitions** (auto-advance after N seconds).
- **Transition animations** between titles (the Screenshot 6 "Transition" dropdown is a placeholder for a future iteration).
- **Multi-channel rundowns** (separate AIR for "lower-third" vs. "scoreboard" layers). The current model supports one on-air title at a time per rundown.

These are explicitly out of scope. See [roadmap.md](./roadmap.md).
