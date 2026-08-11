# Multi-Layer Preview → Air Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-on-air-title controller into a preview→program switcher where several overlays can be live at once, the operator stages a composition in Preview and takes it to Air additively, full-screen titles clear Air on take, an explicit per-item `layer` (0–10) drives z-order, and reloading any `/preview`, `/air`, or admin window restores the current set.

**Architecture:** Two in-memory composition buses per rundown — a **Preview set** (toggle-driven, rendered on `/preview`) and an **Air set** (take + hide-air, rendered on `/air`), both keyed by `itemId`. The full-screen-clears-Air rule is computed **once, server-side**, in a pure `computeTake` function behind a `/take` route. The bus is an in-process relay that **also remembers the current set per `(rundownId, channel)`**; the SSE stream route **replays that snapshot to every newly-connecting client**, so a reloaded window recovers. The two SSE streams are the source of truth for what is staged/live — the admin control page derives both sets from them (no composition state in Redux).

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Drizzle ORM + Neon Postgres · Zod · Redux Toolkit + RTK Query · MUI (admin) · **Vitest** (+ `@testing-library/react` + jsdom for component/hook tests).

**Design source:** `docs/superpowers/specs/2026-06-21-multi-layer-preview-air-design.md`.

## Prerequisites (NOT built by this plan)

This plan assumes the base app from `docs/` already exists and exports these identifiers. If they are missing, build them first — they are out of scope here:

- `@/db` → `db` (Drizzle client) and `@/db/schema` with at least `projects`, `rundowns`, `rundownItems` (with `id`, `rundownId`, `projectId`, `titleKey`, `position`, `label`, `data jsonb`).
- `@/lib/auth` → `requireSession()` (throws/redirects when unauthenticated), used by existing protected routes.
- `@/lib/broadcast/bus` → a **channel-aware** bus:
  - `publish(rundownId: string, channel: 'preview' | 'air', event: BroadcastEvent): void`
  - `subscribe(rundownId: string, channel: 'preview' | 'air', fn: (e: BroadcastEvent) => void): () => void`
  - Before this plan, `BroadcastEvent` is the single-title shape `{ type; itemId; titleKey?; data? }`. Task 3 widens it; Task 5 makes the bus stateful.
- `@/lib/titles/registry` → `getTitleRegistry(projectId: string): Promise<Record<string, { model: import('zod').ZodTypeAny; settings: { title_is_full_screen?: boolean; /* … */ } }>>`; and `getTitle(titleKey)` → `{ Component; settings }` used by the renderer.
- Existing SSE stream route `app/api/broadcast/[rundownId]/stream/route.ts` (Edge), keyed off the `channel` query param. **Task 6 modifies it** to replay the snapshot on connect.
- Existing create-item route `app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts` (POST) validating `data` against the title `model.ts` — Task 2 extends it with `layer`.
- The `editor` Redux slice already exposes `selectedItemId` (for the settings form). **This plan does NOT add composition state to Redux** — staged/live are derived from SSE.
- A configured RTK store (`store/index.ts`) with `combineReducers`, into which Task 12 registers `broadcastApi`.
- **Git is initialized** (`git init` if `git status` fails) and **Vitest is configured** (`npm test` → `vitest run`) — every task ends in a commit and runs tests. If absent, build base sub-plan P0 first.

## Global Constraints

- Server derives scope from **URL + session, never the request body** (the `projectId`/`rundownId` come from `params`; the take's live set comes from the bus, not the body).
- Composition state is **transient** — never written to the DB. It lives in the bus's process memory (survives window reloads while the instance stays warm, not a full server restart). The only persisted new field is `rundown_items.layer`.
- Edge runtime is for the SSE **stream route only**. Every other route in this plan is **Node runtime** (default) — they touch `db`, the registry, and the bus.
- `layer` is an `integer`, **0–10 inclusive**, default `0`. Validate with the shared `layerSchema` everywhere it crosses a boundary.
- Z-order is `(layer asc, position asc)`; higher `layer` renders on top. Full-screen titles honor their own `layer` for stacking — **no z-order special-casing in the renderer**.
- The full-screen-clears-Air rule fires only when a **staged** item being taken is full-screen, and is computed in exactly one place: `computeTake`.
- The bus `publish(rundownId, channel, event)` takes `rundownId` and `channel` as arguments; the `BroadcastEvent` itself does **not** carry `rundownId`.
- `snake_case` DB columns; Drizzle migrations via `db:generate` → commit SQL → `db:migrate`. **Never** run `db:migrate` inside `next build`.

---

### Task 1: Add `layer` column to `rundown_items`

**Files:**
- Modify: `db/schema.ts` (the `rundownItems` table)
- Test: `test/db/rundown-items-schema.test.ts`
- Generated: `db/migrations/<timestamp>_add_rundown_item_layer.sql` (via `db:generate`)

**Interfaces:**
- Produces: `rundownItems.layer` — a non-null integer column, default `0`, available to all later tasks via `@/db/schema`.

- [ ] **Step 1: Write the failing test**

```ts
// test/db/rundown-items-schema.test.ts
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { rundownItems } from '@/db/schema';

describe('rundownItems schema', () => {
  it('has a non-null integer layer column defaulting to 0', () => {
    const { columns } = getTableConfig(rundownItems);
    const layer = columns.find((c) => c.name === 'layer');
    expect(layer).toBeDefined();
    expect(layer!.notNull).toBe(true);
    expect(layer!.default).toBe(0);
    expect(layer!.dataType).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db/rundown-items-schema.test.ts`
Expected: FAIL — `layer` is `undefined`.

- [ ] **Step 3: Add the column**

In `db/schema.ts`, inside the `rundownItems` `pgTable` definition, add after `position`:

```ts
  layer: integer('layer').notNull().default(0),
```

Ensure `integer` is imported from `drizzle-orm/pg-core` (likely already alongside `uuid`, `text`, `jsonb`, `timestamp`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db/rundown-items-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Generate the migration**

Run: `npm run db:generate`
Expected: a new file under `db/migrations/` containing `ALTER TABLE "rundown_items" ADD COLUMN "layer" integer DEFAULT 0 NOT NULL;` (no destructive statements). Open it and confirm.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations test/db/rundown-items-schema.test.ts
git commit -m "feat(db): add layer column to rundown_items"
```

---

### Task 2: `layerSchema` + create-item route accepts `layer`

**Files:**
- Create: `lib/broadcast/layer.ts`
- Modify: `app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts`
- Test: `test/broadcast/layer.test.ts`

**Interfaces:**
- Produces: `layerSchema: z.ZodNumber` — `z.number().int().min(0).max(10)`. Consumed by Tasks 8, 12.
- Produces: create-item route now persists `layer` (default `0`).

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/layer.test.ts
import { describe, it, expect } from 'vitest';
import { layerSchema } from '@/lib/broadcast/layer';

describe('layerSchema', () => {
  it('accepts integers 0..10', () => {
    expect(layerSchema.parse(0)).toBe(0);
    expect(layerSchema.parse(10)).toBe(10);
  });
  it('rejects out-of-range and non-integers', () => {
    expect(layerSchema.safeParse(-1).success).toBe(false);
    expect(layerSchema.safeParse(11).success).toBe(false);
    expect(layerSchema.safeParse(2.5).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/broadcast/layer.test.ts`
Expected: FAIL — cannot import `layerSchema`.

- [ ] **Step 3: Implement the schema**

```ts
// lib/broadcast/layer.ts
import { z } from 'zod';

export const layerSchema = z.number().int().min(0).max(10);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/broadcast/layer.test.ts`
Expected: PASS.

- [ ] **Step 5: Thread `layer` through the create-item route**

In `app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts`, add `import { layerSchema } from '@/lib/broadcast/layer';`, then validate `layer` (default `0`) and include it in the insert:

```ts
const body = await req.json();
const layer = layerSchema.default(0).parse(body.layer);
// … existing titleKey / data validation unchanged …
await db.insert(rundownItems).values({
  rundownId: params.rundownId,
  projectId: params.projectId,
  titleKey: body.titleKey,
  position: body.position,
  label: body.label,
  layer,
  data,
});
```

- [ ] **Step 6: Commit**

```bash
git add lib/broadcast/layer.ts app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts test/broadcast/layer.test.ts
git commit -m "feat(api): validate and persist rundown item layer"
```

---

### Task 3: Widen `BroadcastEvent` with `layer` and `position`

**Files:**
- Modify: `lib/broadcast/bus.ts` (the `BroadcastEvent` type only)
- Test: `test/broadcast/bus-event-shape.test.ts`

**Interfaces:**
- Produces: the canonical event type consumed by Tasks 4–11 (no `rundownId` on the event — `publish` takes it as an argument):

```ts
export type BroadcastEvent =
  | { type: 'show';    itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide';    itemId: string }
  | { type: 'update';  itemId: string; layer: number; position: number; data: unknown }
  | { type: 'command'; itemId: string; action: string; payload?: unknown };
```

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/bus-event-shape.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { BroadcastEvent } from '@/lib/broadcast/bus';

describe('BroadcastEvent', () => {
  it('show carries titleKey, layer, position, data', () => {
    const e: BroadcastEvent = {
      type: 'show', itemId: 'i1', titleKey: 'lower-third', layer: 3, position: 0, data: {},
    };
    expectTypeOf(e).toMatchTypeOf<{ layer: number; position: number }>();
  });
  it('hide carries only itemId', () => {
    const e: BroadcastEvent = { type: 'hide', itemId: 'i1' };
    expectTypeOf(e.type).toEqualTypeOf<'show' | 'hide' | 'update' | 'command'>();
  });
  it('command carries an action name', () => {
    const e: BroadcastEvent = { type: 'command', itemId: 'i1', action: 'start' };
    expectTypeOf(e).toMatchTypeOf<{ action: string }>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/broadcast/bus-event-shape.test.ts`
Expected: FAIL — `layer`/`position` not assignable on the old single-title `show` shape.

- [ ] **Step 3: Update the type**

Replace the `BroadcastEvent` union in `lib/broadcast/bus.ts` with the shape in **Interfaces** above. Leave `publish`/`subscribe` signatures untouched (Task 5 extends `publish`'s body).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/broadcast/bus-event-shape.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/bus.ts test/broadcast/bus-event-shape.test.ts
git commit -m "feat(broadcast): add layer and position to BroadcastEvent"
```

---

### Task 4: `applyEvent` + `sortLiveSet` — the shared set-reducer

**Files:**
- Create: `lib/broadcast/liveSet.ts`
- Test: `test/broadcast/liveSet.test.ts`

**Interfaces:**
- Produces (consumed by the bus snapshot in Task 5 **and** the client hook in Task 11):

```ts
export interface LiveTitle { itemId: string; titleKey: string; layer: number; position: number; data: unknown; }
export function applyEvent(map: Map<string, LiveTitle>, event: BroadcastEvent): Map<string, LiveTitle>;
export function sortLiveSet(map: Map<string, LiveTitle>): LiveTitle[]; // (layer asc, position asc)
```

`applyEvent` returns a **new** Map: `show` sets/replaces, `hide` deletes, `update` merges `layer`/`position`/`data` onto an existing entry (ignored if absent). It imports `BroadcastEvent` as a **type-only** import (`import type`) to avoid a runtime cycle with `bus.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/liveSet.test.ts
import { describe, it, expect } from 'vitest';
import { applyEvent, sortLiveSet, type LiveTitle } from '@/lib/broadcast/liveSet';

const lt = (itemId: string, layer: number, position = 0): LiveTitle => ({
  itemId, titleKey: 't', layer, position, data: {},
});

describe('applyEvent', () => {
  it('show adds an entry without mutating the input map', () => {
    const m0 = new Map<string, LiveTitle>();
    const m1 = applyEvent(m0, { type: 'show', itemId: 'a', titleKey: 't', layer: 1, position: 0, data: { x: 1 } });
    expect(m0.size).toBe(0);
    expect(m1.get('a')).toMatchObject({ layer: 1, data: { x: 1 } });
  });

  it('hide removes the entry', () => {
    const m1 = applyEvent(new Map([['a', lt('a', 1)]]), { type: 'hide', itemId: 'a' });
    expect(m1.has('a')).toBe(false);
  });

  it('update merges layer/position/data onto an existing entry', () => {
    const m1 = applyEvent(
      new Map([['a', lt('a', 1)]]),
      { type: 'update', itemId: 'a', layer: 5, position: 2, data: { y: 9 } },
    );
    expect(m1.get('a')).toMatchObject({ layer: 5, position: 2, data: { y: 9 } });
  });

  it('update on an absent entry is a no-op', () => {
    const m1 = applyEvent(new Map(), { type: 'update', itemId: 'ghost', layer: 5, position: 0, data: {} });
    expect(m1.size).toBe(0);
  });

  it('command does not alter the set (fire-and-forget, never snapshotted)', () => {
    const m0 = new Map([['a', lt('a', 1)]]);
    const m1 = applyEvent(m0, { type: 'command', itemId: 'a', action: 'start' });
    expect([...m1.entries()]).toEqual([...m0.entries()]);
  });
});

describe('sortLiveSet', () => {
  it('orders by layer asc then position asc', () => {
    const m = new Map([['a', lt('a', 2, 0)], ['b', lt('b', 0, 1)], ['c', lt('c', 0, 0)]]);
    expect(sortLiveSet(m).map((t) => t.itemId)).toEqual(['c', 'b', 'a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/broadcast/liveSet.test.ts`
Expected: FAIL — cannot import from `liveSet`.

- [ ] **Step 3: Implement**

```ts
// lib/broadcast/liveSet.ts
import type { BroadcastEvent } from '@/lib/broadcast/bus';

export interface LiveTitle {
  itemId: string; titleKey: string; layer: number; position: number; data: unknown;
}

export function applyEvent(map: Map<string, LiveTitle>, event: BroadcastEvent): Map<string, LiveTitle> {
  // command events are imperative + fire-and-forget: never part of the set
  if (event.type === 'command') return map;

  const next = new Map(map);
  if (event.type === 'show') {
    next.set(event.itemId, {
      itemId: event.itemId, titleKey: event.titleKey, layer: event.layer, position: event.position, data: event.data,
    });
  } else if (event.type === 'hide') {
    next.delete(event.itemId);
  } else {
    const existing = next.get(event.itemId);
    if (existing) {
      next.set(event.itemId, { ...existing, layer: event.layer, position: event.position, data: event.data });
    }
  }
  return next;
}

export function sortLiveSet(map: Map<string, LiveTitle>): LiveTitle[] {
  return [...map.values()].sort((a, b) => a.layer - b.layer || a.position - b.position);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/broadcast/liveSet.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/liveSet.ts test/broadcast/liveSet.test.ts
git commit -m "feat(broadcast): applyEvent + sortLiveSet set-reducer"
```

---

### Task 5: Make the bus stateful (snapshot per channel)

**Files:**
- Modify: `lib/broadcast/bus.ts` (extend `publish`, add `getSnapshot`)
- Test: `test/broadcast/bus-snapshot.test.ts`

**Interfaces:**
- Consumes: `applyEvent`, `sortLiveSet`, `LiveTitle` (Task 4).
- Produces: `publish` now also updates an in-memory snapshot keyed by `(rundownId, channel)`; and `getSnapshot(rundownId: string, channel: 'preview' | 'air'): LiveTitle[]` (sorted). Consumed by Tasks 6 and 8.

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/bus-snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { publish, getSnapshot } from '@/lib/broadcast/bus';

describe('bus snapshot', () => {
  it('accumulates show/hide into the current set and replays it sorted', () => {
    publish('rs1', 'air', { type: 'show', itemId: 'a', titleKey: 't', layer: 2, position: 0, data: {} });
    publish('rs1', 'air', { type: 'show', itemId: 'b', titleKey: 't', layer: 0, position: 0, data: {} });
    publish('rs1', 'air', { type: 'hide', itemId: 'a' });
    expect(getSnapshot('rs1', 'air').map((t) => t.itemId)).toEqual(['b']);
  });

  it('isolates channels and rundowns', () => {
    publish('rs2', 'preview', { type: 'show', itemId: 'p', titleKey: 't', layer: 0, position: 0, data: {} });
    expect(getSnapshot('rs2', 'air')).toEqual([]);
    expect(getSnapshot('rs2', 'preview').map((t) => t.itemId)).toEqual(['p']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/broadcast/bus-snapshot.test.ts`
Expected: FAIL — `getSnapshot` not exported.

- [ ] **Step 3: Add snapshot state to the bus**

In `lib/broadcast/bus.ts`, add (alongside the existing subscriber registry):

```ts
import { applyEvent, sortLiveSet, type LiveTitle } from '@/lib/broadcast/liveSet';

type Channel = 'preview' | 'air';
const snapshots = new Map<string, Map<string, LiveTitle>>(); // key: `${rundownId}:${channel}`
const snapKey = (rundownId: string, channel: Channel) => `${rundownId}:${channel}`;

export function getSnapshot(rundownId: string, channel: Channel): LiveTitle[] {
  return sortLiveSet(snapshots.get(snapKey(rundownId, channel)) ?? new Map());
}
```

Then, inside the existing `publish(rundownId, channel, event)`, update the snapshot **before** dispatching to subscribers:

```ts
export function publish(rundownId: string, channel: Channel, event: BroadcastEvent) {
  const k = snapKey(rundownId, channel);
  snapshots.set(k, applyEvent(snapshots.get(k) ?? new Map(), event));
  subscribers.get(k)?.forEach((fn) => fn(event));   // existing dispatch, key by `${rundownId}:${channel}`
}
```

(If the existing subscriber registry is keyed differently, keep its key but ensure both registries use the same `(rundownId, channel)` composite.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/broadcast/bus-snapshot.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/bus.ts test/broadcast/bus-snapshot.test.ts
git commit -m "feat(broadcast): stateful bus snapshot per (rundown, channel)"
```

---

### Task 6: Replay the snapshot on SSE connect

**Files:**
- Modify: `app/api/broadcast/[rundownId]/stream/route.ts`
- Test: `test/api/stream-replay.test.ts`

**Interfaces:**
- Consumes: `getSnapshot`, `subscribe` (Task 5 / prereq).
- Produces: the stream emits the current set as `show` events immediately on connect, then live events. Enables reload recovery.

- [ ] **Step 1: Write the failing test**

```ts
// test/api/stream-replay.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/broadcast/bus', () => ({
  getSnapshot: vi.fn(() => [{ itemId: 'a', titleKey: 't', layer: 1, position: 0, data: { x: 1 } }]),
  subscribe: vi.fn(() => () => {}),
}));

import { GET } from '@/app/api/broadcast/[rundownId]/stream/route';

describe('stream replay-on-connect', () => {
  it('replays the snapshot as show events before live events', async () => {
    const res = await GET(new Request('http://t/stream?channel=air'), { params: { rundownId: 'r1' } });
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"type":"show"');
    expect(text).toContain('"itemId":"a"');
    await reader.cancel();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api/stream-replay.test.ts`
Expected: FAIL — current route streams nothing until a live publish.

- [ ] **Step 3: Replay the snapshot in the stream route**

```ts
// app/api/broadcast/[rundownId]/stream/route.ts
import { subscribe, getSnapshot } from '@/lib/broadcast/bus';

export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: { rundownId: string } }) {
  const channel = (new URL(req.url).searchParams.get('channel') === 'air' ? 'air' : 'preview') as 'preview' | 'air';
  const enc = new TextEncoder();
  let unsub: (() => void) | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // 1) reload recovery: replay the current set so a reconnecting client rebuilds it
      for (const t of getSnapshot(params.rundownId, channel)) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'show', ...t })}\n\n`));
      }
      // 2) live events
      unsub = subscribe(params.rundownId, channel, (event) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      beat = setInterval(() => controller.enqueue(enc.encode(': beat\n\n')), 15000);
    },
    cancel() { if (beat) clearInterval(beat); unsub?.(); },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api/stream-replay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/broadcast/[rundownId]/stream/route.ts test/api/stream-replay.test.ts
git commit -m "feat(broadcast): replay snapshot on SSE connect for reload recovery"
```

---

### Task 7: `computeTake` — the full-screen-clears-Air rule

**Files:**
- Create: `lib/broadcast/take.ts`
- Test: `test/broadcast/take.test.ts`

**Interfaces:**
- Produces:

```ts
export interface StagedItem {
  itemId: string; titleKey: string; layer: number; position: number; data: unknown; isFullScreen: boolean;
}
export interface TakeResult {
  hides: string[];          // itemIds to hide on the air channel
  shows: StagedItem[];      // items to show on the air channel
  newAirSet: string[];      // resulting live itemIds, in render priority order
}
export function computeTake(staged: StagedItem[], liveItemIds: string[]): TakeResult;
```

Rules: if **any** `staged` item `isFullScreen`, hide all `liveItemIds` and the new Air set is exactly the staged itemIds. Otherwise hide nothing and union live + staged (live first, then staged items not already live). `shows` is always every staged item (re-showing an already-live item is an idempotent refresh).

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/take.test.ts
import { describe, it, expect } from 'vitest';
import { computeTake, type StagedItem } from '@/lib/broadcast/take';

const item = (id: string, fs = false): StagedItem => ({
  itemId: id, titleKey: 't', layer: 0, position: 0, data: {}, isFullScreen: fs,
});

describe('computeTake', () => {
  it('additive take: stacks staged onto live, hides nothing', () => {
    const r = computeTake([item('b')], ['a']);
    expect(r.hides).toEqual([]);
    expect(r.shows.map((s) => s.itemId)).toEqual(['b']);
    expect(r.newAirSet).toEqual(['a', 'b']);
  });

  it('does not duplicate an already-live item in newAirSet', () => {
    const r = computeTake([item('a')], ['a']);
    expect(r.newAirSet).toEqual(['a']);
    expect(r.shows.map((s) => s.itemId)).toEqual(['a']); // idempotent refresh
  });

  it('full-screen staged item clears all live, then shows the staged set', () => {
    const r = computeTake([item('fs', true)], ['a', 'b']);
    expect(r.hides).toEqual(['a', 'b']);
    expect(r.shows.map((s) => s.itemId)).toEqual(['fs']);
    expect(r.newAirSet).toEqual(['fs']);
  });

  it('full-screen + companion staged together: clears live, shows both', () => {
    const r = computeTake([item('fs', true), item('lt')], ['x']);
    expect(r.hides).toEqual(['x']);
    expect(r.shows.map((s) => s.itemId)).toEqual(['fs', 'lt']);
    expect(r.newAirSet).toEqual(['fs', 'lt']);
  });

  it('empty staged take is a no-op', () => {
    const r = computeTake([], ['a']);
    expect(r).toEqual({ hides: [], shows: [], newAirSet: ['a'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/broadcast/take.test.ts`
Expected: FAIL — cannot import `computeTake`.

- [ ] **Step 3: Implement**

```ts
// lib/broadcast/take.ts
export interface StagedItem {
  itemId: string; titleKey: string; layer: number; position: number; data: unknown; isFullScreen: boolean;
}
export interface TakeResult {
  hides: string[];
  shows: StagedItem[];
  newAirSet: string[];
}

export function computeTake(staged: StagedItem[], liveItemIds: string[]): TakeResult {
  if (staged.length === 0) {
    return { hides: [], shows: [], newAirSet: [...liveItemIds] };
  }
  if (staged.some((s) => s.isFullScreen)) {
    return { hides: [...liveItemIds], shows: [...staged], newAirSet: staged.map((s) => s.itemId) };
  }
  const stagedIds = staged.map((s) => s.itemId);
  const added = stagedIds.filter((id) => !liveItemIds.includes(id));
  return { hides: [], shows: [...staged], newAirSet: [...liveItemIds, ...added] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/broadcast/take.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/take.ts test/broadcast/take.test.ts
git commit -m "feat(broadcast): computeTake with full-screen-clears-air rule"
```

---

### Task 8: `/take` route — promote Preview set to Air

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/take/route.ts`
- Test: `test/api/take-route.test.ts`

**Interfaces:**
- Consumes: `computeTake` (Task 7), `getSnapshot` + `publish` (Task 5), `getTitleRegistry` (prereq), `db` + `rundownItems`, `requireSession`.
- Produces: `POST` handler. Body: `{ stagedItemIds: string[] }`. The live set is read from the **bus air snapshot** (not the body). Response `200` `{ airSet: string[] }`. Publishes `hide`/`show` on the **air** channel.

- [ ] **Step 1: Write the failing test**

```ts
// test/api/take-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const publish = vi.fn();
const getSnapshot = vi.fn();
const findMany = vi.fn();

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) }));
vi.mock('@/lib/broadcast/bus', () => ({ publish, getSnapshot }));
vi.mock('@/db', () => ({ db: { query: { rundownItems: { findMany: (...a: unknown[]) => findMany(...a) } } } }));
vi.mock('@/db/schema', () => ({ rundownItems: {} }));
vi.mock('@/lib/titles/registry', () => ({
  getTitleRegistry: vi.fn().mockResolvedValue({
    'lower-third': { settings: { title_is_full_screen: false } },
    splash: { settings: { title_is_full_screen: true } },
  }),
}));

import { POST } from '@/app/api/projects/[projectId]/rundowns/[rundownId]/take/route';

const ctx = { params: { projectId: 'p1', rundownId: 'r1' } };
const req = (body: unknown) => new Request('http://t/take', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => { publish.mockClear(); findMany.mockClear(); getSnapshot.mockReset(); });

describe('POST /take', () => {
  it('additive: reads live from air snapshot, shows staged, hides nothing', async () => {
    getSnapshot.mockReturnValue([{ itemId: 'a', titleKey: 'lower-third', layer: 0, position: 0, data: {} }]);
    findMany.mockResolvedValue([{ id: 'b', titleKey: 'lower-third', layer: 2, position: 1, data: { x: 1 } }]);
    const res = await POST(req({ stagedItemIds: ['b'] }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ airSet: ['a', 'b'] });
    expect(getSnapshot).toHaveBeenCalledWith('r1', 'air');
    const ops = publish.mock.calls.map((c) => [c[1], c[2].type, c[2].itemId]);
    expect(ops).toEqual([['air', 'show', 'b']]);
    expect(publish.mock.calls[0][2]).toMatchObject({ layer: 2, position: 1, titleKey: 'lower-third' });
  });

  it('full-screen staged clears live then shows staged', async () => {
    getSnapshot.mockReturnValue([
      { itemId: 'a', titleKey: 'lower-third', layer: 0, position: 0, data: {} },
      { itemId: 'b', titleKey: 'lower-third', layer: 0, position: 0, data: {} },
    ]);
    findMany.mockResolvedValue([{ id: 'fs', titleKey: 'splash', layer: 0, position: 0, data: {} }]);
    const res = await POST(req({ stagedItemIds: ['fs'] }), ctx);
    expect(await res.json()).toEqual({ airSet: ['fs'] });
    const ops = publish.mock.calls.map((c) => [c[2].type, c[2].itemId]);
    expect(ops).toEqual([['hide', 'a'], ['hide', 'b'], ['show', 'fs']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api/take-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/projects/[projectId]/rundowns/[rundownId]/take/route.ts
import { db } from '@/db';
import { rundownItems } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { publish, getSnapshot } from '@/lib/broadcast/bus';
import { getTitleRegistry } from '@/lib/titles/registry';
import { computeTake, type StagedItem } from '@/lib/broadcast/take';
import { z } from 'zod';

const bodySchema = z.object({ stagedItemIds: z.array(z.string().uuid()) });

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; rundownId: string } },
) {
  await requireSession();
  const { stagedItemIds } = bodySchema.parse(await req.json());
  const liveItemIds = getSnapshot(params.rundownId, 'air').map((t) => t.itemId);

  const rows = stagedItemIds.length
    ? await db.query.rundownItems.findMany({
        where: and(eq(rundownItems.rundownId, params.rundownId), inArray(rundownItems.id, stagedItemIds)),
      })
    : [];

  const registry = await getTitleRegistry(params.projectId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const staged: StagedItem[] = stagedItemIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      itemId: r.id,
      titleKey: r.titleKey,
      layer: r.layer,
      position: r.position,
      data: r.data,
      isFullScreen: Boolean(registry[r.titleKey]?.settings?.title_is_full_screen),
    }));

  const { hides, shows, newAirSet } = computeTake(staged, liveItemIds);

  for (const itemId of hides) publish(params.rundownId, 'air', { type: 'hide', itemId });
  for (const s of shows) {
    publish(params.rundownId, 'air', {
      type: 'show', itemId: s.itemId, titleKey: s.titleKey, layer: s.layer, position: s.position, data: s.data,
    });
  }

  return Response.json({ airSet: newAirSet });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api/take-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[projectId]/rundowns/[rundownId]/take/route.ts test/api/take-route.test.ts
git commit -m "feat(api): take route promotes preview set to air (live read from snapshot)"
```

---

### Task 9: Preview toggle route (POST add / DELETE remove)

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/preview/route.ts`
- Test: `test/api/preview-route.test.ts`

**Interfaces:**
- Consumes: `db`, `rundownItems`, `requireSession`, `publish`.
- Produces: `POST` → `show` on **preview** channel (`204`); `DELETE` → `hide` on **preview** channel (`204`).

- [ ] **Step 1: Write the failing test**

```ts
// test/api/preview-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const publish = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) }));
vi.mock('@/lib/broadcast/bus', () => ({ publish }));
vi.mock('@/db', () => ({ db: { query: { rundownItems: { findFirst: (...a: unknown[]) => findFirst(...a) } } } }));
vi.mock('@/db/schema', () => ({ rundownItems: {} }));

import { POST, DELETE } from '@/app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/preview/route';

const ctx = { params: { projectId: 'p1', rundownId: 'r1', itemId: 'i1' } };
const req = () => new Request('http://t/preview', { method: 'POST' });

beforeEach(() => { publish.mockClear(); findFirst.mockClear(); });

describe('preview route', () => {
  it('POST publishes show on preview channel', async () => {
    findFirst.mockResolvedValue({ id: 'i1', titleKey: 'lower-third', layer: 1, position: 0, data: { a: 1 } });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(204);
    expect(publish).toHaveBeenCalledWith('r1', 'preview', {
      type: 'show', itemId: 'i1', titleKey: 'lower-third', layer: 1, position: 0, data: { a: 1 },
    });
  });

  it('POST 404s when item is missing', async () => {
    findFirst.mockResolvedValue(undefined);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
    expect(publish).not.toHaveBeenCalled();
  });

  it('DELETE publishes hide on preview channel', async () => {
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(204);
    expect(publish).toHaveBeenCalledWith('r1', 'preview', { type: 'hide', itemId: 'i1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api/preview-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/preview/route.ts
import { db } from '@/db';
import { rundownItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { publish } from '@/lib/broadcast/bus';

type Ctx = { params: { projectId: string; rundownId: string; itemId: string } };

export async function POST(_req: Request, { params }: Ctx) {
  await requireSession();
  const item = await db.query.rundownItems.findFirst({
    where: and(eq(rundownItems.id, params.itemId), eq(rundownItems.rundownId, params.rundownId)),
  });
  if (!item) return new Response('Not found', { status: 404 });

  publish(params.rundownId, 'preview', {
    type: 'show', itemId: item.id, titleKey: item.titleKey, layer: item.layer, position: item.position, data: item.data,
  });
  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await requireSession();
  publish(params.rundownId, 'preview', { type: 'hide', itemId: params.itemId });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api/preview-route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/preview/route.ts test/api/preview-route.test.ts
git commit -m "feat(api): preview toggle route (stage/unstage on preview channel)"
```

---

### Task 10: Hide-air route (per-item)

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/hide-air/route.ts`
- Test: `test/api/hide-air-route.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `publish`.
- Produces: `POST` → `hide` on **air** channel for `itemId` (`204`).

- [ ] **Step 1: Write the failing test**

```ts
// test/api/hide-air-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const publish = vi.fn();
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) }));
vi.mock('@/lib/broadcast/bus', () => ({ publish }));

import { POST } from '@/app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/hide-air/route';

const ctx = { params: { projectId: 'p1', rundownId: 'r1', itemId: 'i1' } };

beforeEach(() => publish.mockClear());

describe('hide-air route', () => {
  it('publishes hide on air channel', async () => {
    const res = await POST(new Request('http://t', { method: 'POST' }), ctx);
    expect(res.status).toBe(204);
    expect(publish).toHaveBeenCalledWith('r1', 'air', { type: 'hide', itemId: 'i1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api/hide-air-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/hide-air/route.ts
import { requireSession } from '@/lib/auth';
import { publish } from '@/lib/broadcast/bus';

type Ctx = { params: { projectId: string; rundownId: string; itemId: string } };

export async function POST(_req: Request, { params }: Ctx) {
  await requireSession();
  publish(params.rundownId, 'air', { type: 'hide', itemId: params.itemId });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api/hide-air-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/hide-air/route.ts test/api/hide-air-route.test.ts
git commit -m "feat(api): per-item hide-air route"
```

---

### Task 10b: Update route (both channels) + Command route (one channel)

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/update/route.ts`
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/command/route.ts`
- Test: `test/api/update-command-routes.test.ts`

**Interfaces:**
- Consumes: `db`, `rundownItems`, `requireSession`, `publish`, `getTitleRegistry`.
- Produces:
  - `update`: `POST` → re-reads the item and publishes `update` to **both** `preview` and `air` (the widget UPDATE button). `204`.
  - `command`: `POST` body `{ action: string; channel: 'preview' | 'air'; payload?: unknown }` → validates `action` against the title's **declared actions** (`registry[titleKey].actions`), rejects unknown with `400`, else publishes `command` on that channel. `204`.

- [ ] **Step 1: Write the failing test**

```ts
// test/api/update-command-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const publish = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/auth', () => ({ requireSession: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) }));
vi.mock('@/lib/broadcast/bus', () => ({ publish }));
vi.mock('@/db', () => ({ db: { query: { rundownItems: { findFirst: (...a: unknown[]) => findFirst(...a) } } } }));
vi.mock('@/db/schema', () => ({ rundownItems: {} }));
vi.mock('@/lib/titles/registry', () => ({
  getTitleRegistry: vi.fn().mockResolvedValue({ 'opening-timer': { actions: ['start', 'stop', 'reset'] } }),
}));

import { POST as UPDATE } from '@/app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/update/route';
import { POST as COMMAND } from '@/app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/command/route';

const ctx = { params: { projectId: 'p1', rundownId: 'r1', itemId: 'i1' } };
const post = (body?: unknown) =>
  new Request('http://t', { method: 'POST', body: body ? JSON.stringify(body) : undefined });

beforeEach(() => { publish.mockClear(); findFirst.mockClear(); });

describe('update route', () => {
  it('publishes update on BOTH channels', async () => {
    findFirst.mockResolvedValue({ id: 'i1', titleKey: 'opening-timer', layer: 1, position: 0, data: { x: 1 } });
    const res = await UPDATE(post(), ctx);
    expect(res.status).toBe(204);
    expect(publish.mock.calls.map((c) => c[1])).toEqual(['preview', 'air']);
    expect(publish.mock.calls[0][2]).toMatchObject({ type: 'update', itemId: 'i1', data: { x: 1 } });
  });
});

describe('command route', () => {
  it('publishes a declared action on the requested channel only', async () => {
    findFirst.mockResolvedValue({ id: 'i1', titleKey: 'opening-timer' });
    const res = await COMMAND(post({ action: 'start', channel: 'air' }), ctx);
    expect(res.status).toBe(204);
    expect(publish).toHaveBeenCalledWith('r1', 'air', { type: 'command', itemId: 'i1', action: 'start', payload: undefined });
  });

  it('rejects an action the title did not declare', async () => {
    findFirst.mockResolvedValue({ id: 'i1', titleKey: 'opening-timer' });
    const res = await COMMAND(post({ action: 'explode', channel: 'air' }), ctx);
    expect(res.status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api/update-command-routes.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Implement both routes**

```ts
// app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/update/route.ts
import { db } from '@/db';
import { rundownItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { publish } from '@/lib/broadcast/bus';

type Ctx = { params: { projectId: string; rundownId: string; itemId: string } };

export async function POST(_req: Request, { params }: Ctx) {
  await requireSession();
  const item = await db.query.rundownItems.findFirst({
    where: and(eq(rundownItems.id, params.itemId), eq(rundownItems.rundownId, params.rundownId)),
  });
  if (!item) return new Response('Not found', { status: 404 });

  const event = {
    type: 'update' as const, itemId: item.id, layer: item.layer, position: item.position, data: item.data,
  };
  publish(params.rundownId, 'preview', event);
  publish(params.rundownId, 'air', event);
  return new Response(null, { status: 204 });
}
```

```ts
// app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/command/route.ts
import { db } from '@/db';
import { rundownItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { publish } from '@/lib/broadcast/bus';
import { getTitleRegistry } from '@/lib/titles/registry';
import { z } from 'zod';

const bodySchema = z.object({
  action: z.string().min(1),
  channel: z.enum(['preview', 'air']),
  payload: z.unknown().optional(),
});

type Ctx = { params: { projectId: string; rundownId: string; itemId: string } };

export async function POST(req: Request, { params }: Ctx) {
  await requireSession();
  const { action, channel, payload } = bodySchema.parse(await req.json());

  const item = await db.query.rundownItems.findFirst({
    where: and(eq(rundownItems.id, params.itemId), eq(rundownItems.rundownId, params.rundownId)),
  });
  if (!item) return new Response('Not found', { status: 404 });

  const registry = await getTitleRegistry(params.projectId);
  const declared: string[] = registry[item.titleKey]?.actions ?? [];
  if (!declared.includes(action)) return new Response('Unknown action', { status: 400 });

  publish(params.rundownId, channel, { type: 'command', itemId: item.id, action, payload });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api/update-command-routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/update app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/command test/api/update-command-routes.test.ts
git commit -m "feat(api): update route (both channels) and validated command route"
```

---

### Task 11: `useTitleStream` returns a set; `TitleRenderer` renders the stack

**Files:**
- Modify: `lib/broadcast/useTitleStream.ts` (return `LiveTitle[]`)
- Modify: `lib/broadcast/TitleRenderer.tsx` (render the array with z-index)
- Modify: `app/(broadcast)/air/[rundownId]/page.tsx`, `app/(broadcast)/preview/[rundownId]/page.tsx` (pass the array)
- Test: `test/broadcast/useTitleStream.test.ts`

**Interfaces:**
- Consumes: `applyEvent`, `sortLiveSet`, `LiveTitle` (Task 4); `getTitle(titleKey)` (prereq).
- Produces: `useTitleStream(rundownId, channel): LiveTitle[]` (consumed by `/air`, `/preview`, and the controller in Task 12); `TitleRenderer({ titles, packageLabel })`.

> The reducer logic is already unit-tested in Task 4. Here we test the hook's wiring (EventSource → reducer → sorted set) with a fake `EventSource`. The snapshot replay (Task 6) arrives as ordinary `show` events, so no extra hook logic is needed for reload recovery.
>
> **Command events:** `applyEvent` already ignores them, so they cannot corrupt the set — the hook stays correct with no extra code. *Delivering* commands to the rendered component (the `onCommand` handler) belongs to the title-contract work (`2026-06-21-title-contract-and-thread-widgets-design.md`) and is **not** built here.

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/useTitleStream.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTitleStream } from '@/lib/broadcast/useTitleStream';

class FakeES {
  static last: FakeES | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  url: string;
  constructor(url: string) { this.url = url; FakeES.last = this; }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

beforeEach(() => { vi.stubGlobal('EventSource', FakeES as unknown as typeof EventSource); });

describe('useTitleStream', () => {
  it('accumulates shows into a layer-sorted set and drops on hide', () => {
    const { result } = renderHook(() => useTitleStream('r1', 'air'));
    expect(result.current).toEqual([]);

    act(() => FakeES.last!.emit({ type: 'show', itemId: 'a', titleKey: 't', layer: 2, position: 0, data: {} }));
    act(() => FakeES.last!.emit({ type: 'show', itemId: 'b', titleKey: 't', layer: 0, position: 0, data: {} }));
    expect(result.current.map((t) => t.itemId)).toEqual(['b', 'a']); // sorted by layer

    act(() => FakeES.last!.emit({ type: 'hide', itemId: 'a' }));
    expect(result.current.map((t) => t.itemId)).toEqual(['b']);
  });

  it('subscribes to the channel-specific URL', () => {
    renderHook(() => useTitleStream('r1', 'preview'));
    expect(FakeES.last!.url).toContain('channel=preview');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/broadcast/useTitleStream.test.ts`
Expected: FAIL — current hook returns a single `CurrentTitle`, not an array.

- [ ] **Step 3: Rewrite the hook**

```ts
// lib/broadcast/useTitleStream.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { applyEvent, sortLiveSet, type LiveTitle } from '@/lib/broadcast/liveSet';
import type { BroadcastEvent } from '@/lib/broadcast/bus';

export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[] {
  const [titles, setTitles] = useState<LiveTitle[]>([]);
  const mapRef = useRef<Map<string, LiveTitle>>(new Map());

  useEffect(() => {
    mapRef.current = new Map();
    setTitles([]);
    const es = new EventSource(`/api/broadcast/${rundownId}/stream?channel=${channel}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as BroadcastEvent;
      mapRef.current = applyEvent(mapRef.current, event);
      setTitles(sortLiveSet(mapRef.current));
    };
    return () => es.close();
  }, [rundownId, channel]);

  return titles;
}
```

- [ ] **Step 4: Rewrite the renderer to map the set**

```tsx
// lib/broadcast/TitleRenderer.tsx
'use client';

import { getTitle } from '@/lib/broadcast/registry';
import type { LiveTitle } from '@/lib/broadcast/liveSet';

export function TitleRenderer({ titles, packageLabel }: { titles: LiveTitle[]; packageLabel: string }) {
  return (
    <>
      {titles.map((t) => {
        const title = getTitle(t.titleKey);
        if (!title) return null;
        const s = title.settings;
        const Component = title.Component;
        const bg = s.title_background && `/projects/${packageLabel}/assets/titles/backgrounds/${s.title_background}`;
        return (
          <div
            key={t.itemId}
            className={s.title_is_full_screen ? 'fixed inset-0' : undefined}
            style={{ zIndex: t.layer }}
          >
            {bg && <video src={bg} autoPlay muted loop className="fixed inset-0 -z-10 h-full w-full object-cover" />}
            <Component data={t.data} />
          </div>
        );
      })}
    </>
  );
}
```

Update the two broadcast pages to pass the array (`packageLabel` already comes from the layout's `rundown.project.label`):

```tsx
const titles = useTitleStream(params.rundownId, 'air'); // or 'preview'
return <TitleRenderer titles={titles} packageLabel={packageLabel} />;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/broadcast/useTitleStream.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/broadcast/useTitleStream.ts lib/broadcast/TitleRenderer.tsx app/\(broadcast\) test/broadcast/useTitleStream.test.ts
git commit -m "feat(broadcast): render a layered set on preview/air"
```

---

### Task 12: Controller — derive staged/live from SSE, `broadcastApi`, widget list, Layer dropdown

**Files:**
- Create: `store/apis/broadcastApi.ts`
- Modify: `store/index.ts` (register `broadcastApi` reducer + middleware)
- Create: `app/admin/[projectId]/overlays/[rundownId]/WidgetRow.tsx`
- Modify: the controller page (`app/admin/[projectId]/overlays/[rundownId]/page.tsx` or its client controller component)
- Modify: the Add Template form component (add the **Layer** dropdown 0–10)
- Test: `test/admin/WidgetRow.test.tsx`

**Interfaces:**
- Consumes: `useTitleStream` (Task 11) for both channels; the routes from Tasks 8–10; `layerSchema` (Task 2).
- Produces: `broadcastApi` with mutations `previewItem`, `unpreviewItem`, `hideAirItem`, `takeRundown`; a `WidgetRow` presentational component. **No composition state in Redux** — `staged`/`live` come from the two SSE streams (snapshot-backed, so they survive a reload).

- [ ] **Step 1: Write the failing component test**

```tsx
// test/admin/WidgetRow.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetRow } from '@/app/admin/[projectId]/overlays/[rundownId]/WidgetRow';

describe('WidgetRow', () => {
  it('shows Hide-Air only when the item is live, and fires callbacks', () => {
    const onTogglePreview = vi.fn();
    const onHideAir = vi.fn();
    const item = { id: 'i1', label: 'MVP', titleKey: 'mvp', layer: 1 };

    const { rerender } = render(
      <WidgetRow item={item} staged={false} live={false} onTogglePreview={onTogglePreview} onHideAir={onHideAir} />,
    );
    expect(screen.queryByRole('button', { name: /hide air/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    expect(onTogglePreview).toHaveBeenCalledWith('i1', false);

    rerender(
      <WidgetRow item={item} staged live onTogglePreview={onTogglePreview} onHideAir={onHideAir} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /hide air/i }));
    expect(onHideAir).toHaveBeenCalledWith('i1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/admin/WidgetRow.test.tsx`
Expected: FAIL — `WidgetRow` not found. (If `@testing-library/react`/`jsdom` aren't installed: `npm i -D @testing-library/react @testing-library/jest-dom jsdom`.)

- [ ] **Step 3: Implement `WidgetRow`**

```tsx
// app/admin/[projectId]/overlays/[rundownId]/WidgetRow.tsx
'use client';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

export interface WidgetItem { id: string; label: string | null; titleKey: string; layer: number; }

export function WidgetRow({
  item, staged, live, onTogglePreview, onHideAir,
}: {
  item: WidgetItem;
  staged: boolean;
  live: boolean;
  onTogglePreview: (itemId: string, currentlyStaged: boolean) => void;
  onHideAir: (itemId: string) => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" data-live={live} data-staged={staged}>
      <span>{item.label ?? item.titleKey}</span>
      <Button onClick={() => onTogglePreview(item.id, staged)}>
        {staged ? 'Hide Preview' : 'Preview'}
      </Button>
      {live && <Button color="warning" onClick={() => onHideAir(item.id)}>Hide Air</Button>}
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/admin/WidgetRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `broadcastApi`**

```ts
// store/apis/broadcastApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const broadcastApi = createApi({
  reducerPath: 'broadcastApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/projects' }),
  endpoints: (b) => ({
    previewItem: b.mutation<void, { projectId: string; rundownId: string; itemId: string }>({
      query: ({ projectId, rundownId, itemId }) => ({
        url: `/${projectId}/rundowns/${rundownId}/items/${itemId}/preview`, method: 'POST',
      }),
    }),
    unpreviewItem: b.mutation<void, { projectId: string; rundownId: string; itemId: string }>({
      query: ({ projectId, rundownId, itemId }) => ({
        url: `/${projectId}/rundowns/${rundownId}/items/${itemId}/preview`, method: 'DELETE',
      }),
    }),
    hideAirItem: b.mutation<void, { projectId: string; rundownId: string; itemId: string }>({
      query: ({ projectId, rundownId, itemId }) => ({
        url: `/${projectId}/rundowns/${rundownId}/items/${itemId}/hide-air`, method: 'POST',
      }),
    }),
    takeRundown: b.mutation<{ airSet: string[] }, { projectId: string; rundownId: string; stagedItemIds: string[] }>({
      query: ({ projectId, rundownId, stagedItemIds }) => ({
        url: `/${projectId}/rundowns/${rundownId}/take`, method: 'POST', body: { stagedItemIds },
      }),
    }),
  }),
});

export const {
  usePreviewItemMutation, useUnpreviewItemMutation, useHideAirItemMutation, useTakeRundownMutation,
} = broadcastApi;
```

Register `broadcastApi.reducer` / `broadcastApi.middleware` in `store/index.ts` alongside the existing entity APIs.

- [ ] **Step 6: Wire the controller (derive staged/live from SSE)**

In the controller client component, derive both sets from the two SSE streams (snapshot-backed → reload-safe) and wire the callbacks:

```tsx
const staged = useTitleStream(rundownId, 'preview');
const live = useTitleStream(rundownId, 'air');
const stagedIds = new Set(staged.map((t) => t.itemId));
const liveIds = new Set(live.map((t) => t.itemId));

const [previewItem] = usePreviewItemMutation();
const [unpreviewItem] = useUnpreviewItemMutation();
const [hideAirItem] = useHideAirItemMutation();
const [take] = useTakeRundownMutation();

const togglePreview = (itemId: string, isStaged: boolean) =>
  (isStaged ? unpreviewItem : previewItem)({ projectId, rundownId, itemId });
const hideAir = (itemId: string) => hideAirItem({ projectId, rundownId, itemId });
const onAir = () => take({ projectId, rundownId, stagedItemIds: staged.map((t) => t.itemId) });

// render: items.map((it) => (
//   <WidgetRow key={it.id} item={it}
//     staged={stagedIds.has(it.id)} live={liveIds.has(it.id)}
//     onTogglePreview={togglePreview} onHideAir={hideAir} /> ))
// plus a master AIR button: <Button onClick={onAir}>AIR</Button>
```

No `editor` composition state and no manual dispatch — the SSE echo updates `staged`/`live`, so a reloaded admin tab recovers automatically.

- [ ] **Step 7: Add the Layer dropdown to the Add Template form**

In the Add Template form component (the modal in `screenshots/Screenshot 2026-06-13 at 13.27.50.png`), add a **Layer** `<Select>` (values `0`–`10`, default `0`) bound to the form's `layer` field, and include `layer` in the POST body to the create-item route (Task 2 validates it). With React Hook Form (`zodResolver`), extend the form schema with `layer: layerSchema.default(0)`.

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS — every task's tests green.

- [ ] **Step 9: Commit**

```bash
git add store/apis/broadcastApi.ts store/index.ts app/admin/[projectId]/overlays/[rundownId] test/admin/WidgetRow.test.tsx
git commit -m "feat(admin): preview→air controller (SSE-derived), hide-air, layer dropdown"
```

---

### Task 13: Update the docs that assert single-on-air / dumb bus

**Files:**
- Modify: `docs/rundowns.md`, `docs/preview-air.md`, `docs/state-management.md`, `docs/roadmap.md`, `docs/database.md`

**Interfaces:**
- Produces: documentation consistent with the implemented behavior. No tests.

- [ ] **Step 1: `docs/rundowns.md`**

- Add `layer integer not null default 0` to the `rundownItems` schema block.
- Rewrite the "Controller behavior" table for two buses: Preview/Hide toggles stage to the **preview** channel; **AIR** is an additive take; per-item **Hide Air** removes one live item; full-screen staged items clear Air on take.
- Replace "one on-air title at a time" wording with the multi-layer model; reference the `take`, `preview`, `hide-air` routes and `lib/broadcast/take.ts`.
- Document the **stateful bus snapshot** (`getSnapshot`) and that `publish` updates it.

- [ ] **Step 2: `docs/preview-air.md`**

- Replace the single-`current` `useTitleStream`/`TitleRenderer` sketches with the set versions (return `LiveTitle[]`; render with `style={{ zIndex: layer }}`).
- Update "Preview vs Air channels": **preview** renders the staging set, **air** the live set; AIR no longer mirrors to the preview channel.
- Add `layer`/`position` to the event shape; document **replay-on-connect** in the stream route and that it gives reload recovery.

- [ ] **Step 3: `docs/state-management.md`**

- Replace `onAirItemId` discussion: the `editor` slice keeps only `selectedItemId`; staged/live are **derived from the two SSE streams**, not stored in Redux.

- [ ] **Step 4: `docs/roadmap.md`**

- Move "multiple on-air titles per rundown" out of the out-of-MVP list (shipped via this plan). Keep multi-*channel* rundowns and DB-persisted state (survive server restart) as future.

- [ ] **Step 5: `docs/database.md`**

- Note the `rundown_items.layer` column and that it was added by migration ("add column" = migration).

- [ ] **Step 6: Commit**

```bash
git add docs/rundowns.md docs/preview-air.md docs/state-management.md docs/roadmap.md docs/database.md
git commit -m "docs: multi-layer preview→air with reload recovery"
```

---

## Self-Review

**Spec coverage:**
- Two composition buses (Preview/Air) → Tasks 9, 10, 8, 11. ✅
- Additive take + full-screen-clears-Air rule → `computeTake` (Task 7) + `/take` route (Task 8). ✅
- Rule computed once, server-side → Tasks 7–8; a per-item `air` action reuses `/take` with `stagedItemIds:[itemId]`, so there is no second code path. ✅
- `command` event variant, not snapshotted → Task 3 (type), Task 4 (`applyEvent` ignores it + test), Task 10b (`/command` route with declared-action validation). ✅
- UPDATE resends `data` to both channels → Task 10b (`/update` route). ✅
- Renderers become a set-reducer → Tasks 4, 11. ✅
- Explicit `layer` (0–10), z-order `(layer, position)`, carried in payload → Tasks 1, 2, 3, 4, 8, 9, 11, 12. ✅
- **Reload recovery (stateful bus snapshot + replay-on-connect)** → Tasks 5, 6; admin recovery via SSE-derived sets → Task 12. ✅
- Composition state derived from SSE, not Redux → Tasks 11, 12 (no editor-slice expansion). ✅
- Migration for `rundown_items.layer` → Task 1. ✅
- Doc updates → Task 13. ✅
- Preview stays staged after take → the take only publishes on the **air** channel; the preview snapshot is untouched (Tasks 8, 9). ✅

**Out of scope (per spec), intentionally absent:** "Clear all/panic", DB-persisted state (server-restart survival), transition animations, multi-channel. ✅

**Type consistency:** `BroadcastEvent` (Task 3, no `rundownId`, 4 variants incl. `command`) is consumed by `applyEvent` (Task 4), the bus snapshot (Task 5), the stream route (Task 6), and all routes (Tasks 8–10b). The `/command` route reads `registry[titleKey].actions`, matching the registry shape the title-contract spec defines. `LiveTitle` (Task 4) is returned by `getSnapshot` (Task 5) and `useTitleStream` (Task 11) and consumed by `TitleRenderer` (Task 11). `StagedItem`/`TakeResult` (Task 7) match the `/take` mapping (Task 8). `getSnapshot(rundownId, channel)` signature matches across Tasks 5, 6, 8. `takeRundown` mutation body `{ stagedItemIds }` (Task 12) matches the `/take` body schema (Task 8). `layerSchema` (Task 2) reused in Task 12's form. `WidgetRow` props (Task 12 test) match its implementation. ✅

**Placeholder scan:** none — every code/test step carries real content.

**Ordering check:** `applyEvent` (Task 4) precedes the bus snapshot (Task 5), which precedes the stream replay (Task 6) and `/take` (Task 8) that consume `getSnapshot`. `computeTake` (Task 7) precedes `/take` (Task 8). No task consumes an identifier defined in a later task. ✅
