# Broadcast + Controller MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive a rundown's overlays from a controller UI onto OBS/vMix browser sources (`/preview/[uuid]`, `/air/[uuid]`) live, over an in-process SSE bus.

**Architecture:** An in-process Node pub/sub bus keyed by `uuid:channel` holds a per-key snapshot; a Node SSE route replays the snapshot then streams events; transparent `(broadcast)` renderer pages consume the stream and draw a layer-sorted set via the existing overlay registry; project-scoped Node publisher routes assemble payloads and `publish()`; the controller UI drives them and monitors the real pages via iframes.

**Tech Stack:** Next.js 16 App Router (React 19), TypeScript, Drizzle + Neon (HTTP driver, **no transactions**), Zod, RTK Query, MUI (admin only), GSAP (overlays), Vitest (jsdom + node-env docblock).

## Global Constraints

- **Node runtime** for every broadcast route (`export const runtime = 'nodejs'`) — an Edge route can't see a Node `publish()` (separate module state).
- **No `rundown_overlay_data` table; live state is transient in the bus snapshot**, never persisted.
- **One migration only** (`displays` + `settings`); generate with `npm run db:generate`, commit the SQL, do **not** run `db:migrate` (the user runs it).
- **MVP payload = overlay row + `data.widget`** (no match/participants/sponsors). Overlay components tolerate a missing `match`.
- Project-scoped routes derive ids **from the URL, never the body**; guard with `requireSession(req)` (returns a 401 `Response` or `null`).
- `users.id` is **text**; `settings.userId` is a text FK. `displays.uuid` is text, unique, defaulted via `$defaultFn(() => crypto.randomUUID())`.
- Event set (MVP): `air`, `preview`, `hide`, `hide_all`, `live_update`. `air`/`preview` carry the **full set**; `hide`/`live_update` are deltas; `hide_all` clears.
- Register every new RTK api in `store/index.ts` (rootReducer + entityMiddleware).
- Tests under `test/`; node-only tests start with `// @vitest-environment node`. Lint: max-len 140, one JSX expression per line (`npx eslint --fix` if formatting trips).

---

### Task 1: Data model — `displays` + `settings`

**Files:**
- Modify: `db/schema.ts` (append two tables)
- Create: `db/schemas/displays.ts`
- Create: `test/db/displays.test.ts`
- Generate: `db/migrations/0002_*.sql`

**Interfaces:**
- Produces: `displays` table (`id, uuid, name, projectId, createdAt`), `settings` table (`userId pk, displayId, updatedAt`); `createDisplaySchema` (`{ name: string }`), `setSettingsSchema` (`{ displayId: number | null }`).

- [ ] **Step 1: Write the failing test**

`test/db/displays.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { displays, settings } from '@/db/schema'

describe('displays + settings tables', () => {
  it('displays has uuid/name/projectId', () => {
    const cols = Object.keys(getTableColumns(displays))
    expect(cols).toEqual(expect.arrayContaining(['id', 'uuid', 'name', 'projectId', 'createdAt']))
  })
  it('settings is keyed by userId with a displayId', () => {
    const cols = Object.keys(getTableColumns(settings))
    expect(cols).toEqual(expect.arrayContaining(['userId', 'displayId']))
  })
  it('a committed migration creates both tables', () => {
    const sql = readdirSync('db/migrations').filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join('db/migrations', f), 'utf8')).join('\n').toLowerCase()
    expect(sql).toMatch(/create table (if not exists )?"displays"/)
    expect(sql).toMatch(/create table (if not exists )?"settings"/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- displays`
Expected: FAIL — `displays`/`settings` not exported.

- [ ] **Step 3: Append the tables to `db/schema.ts`**

At the end of `db/schema.ts`:
```ts
// --- broadcast: displays + per-user settings (broadcast pass) ----------------
export const displays = pgTable('displays', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('displays_project_idx').on(t.projectId)])

// Minimal per-user settings: the operator's active display. Broader etalon
// fields (timezone/delay/channel/atem/observer/is_guest) are roadmap.
export const settings = pgTable('settings', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayId: integer('display_id').references(() => displays.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

- [ ] **Step 4: Write the Zod schemas**

`db/schemas/displays.ts`:
```ts
import { z } from 'zod'

export const createDisplaySchema = z.object({ name: z.string().min(1) })
export type CreateDisplayInput = z.infer<typeof createDisplaySchema>

export const setSettingsSchema = z.object({ displayId: z.number().int().nullable() })
export type SetSettingsInput = z.infer<typeof setSettingsSchema>
```

- [ ] **Step 5: Generate the migration**

Run: `npm run db:generate`
Expected: a new `db/migrations/0002_*.sql` creating `displays` + `settings`. Do NOT run `db:migrate`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- displays`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts db/schemas/displays.ts db/migrations test/db/displays.test.ts
git commit -m "feat(broadcast): displays + settings tables + migration"
```

---

### Task 2: Broadcast types + pure live reducer

**Files:**
- Create: `lib/broadcast/types.ts`
- Create: `lib/broadcast/liveReducer.ts`
- Test: `test/broadcast/liveReducer.test.ts`

**Interfaces:**
- Produces:
  - `Channel = 'preview' | 'air'`
  - `OverlayPayload = { id; model; category; template; layer; displayFilter; isFullscreen; data: { widget } }`
  - `BroadcastEvent` union (`air`/`preview` full-set, `hide`, `hide_all`, `live_update`)
  - `applyEvent(set: OverlayPayload[], e: BroadcastEvent): OverlayPayload[]`
  - `upsertById(set: OverlayPayload[], item: OverlayPayload): OverlayPayload[]`
  - `sortByLayer(set: OverlayPayload[]): OverlayPayload[]`
  - `filterByDisplay(set: OverlayPayload[], filter: string | null): OverlayPayload[]`

- [ ] **Step 1: Write the failing test**

`test/broadcast/liveReducer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  applyEvent, upsertById, sortByLayer, filterByDisplay,
} from '@/lib/broadcast/liveReducer'
import type { OverlayPayload } from '@/lib/broadcast/types'

function ov(id: number, over: Partial<OverlayPayload> = {}): OverlayPayload {
  return {
    id, model: 'general-text', category: 'general', template: 'Text', layer: 1,
    displayFilter: null, isFullscreen: false, data: { widget: { text: `t${id}` } }, ...over,
  }
}

describe('liveReducer', () => {
  it('air/preview replace the whole set', () => {
    const next = applyEvent([ov(1)], { type: 'air', data: [ov(2), ov(3)] })
    expect(next.map((o) => o.id)).toEqual([2, 3])
  })
  it('hide removes one by id', () => {
    expect(applyEvent([ov(1), ov(2)], { type: 'hide', data: { id: 1 } }).map((o) => o.id)).toEqual([2])
  })
  it('hide_all clears', () => {
    expect(applyEvent([ov(1), ov(2)], { type: 'hide_all' })).toEqual([])
  })
  it('live_update merges data.widget by id', () => {
    const next = applyEvent([ov(1)], { type: 'live_update', data: { id: 1, widget: { text: 'new' } } })
    expect(next[0].data.widget).toEqual({ text: 'new' })
  })
  it('upsertById replaces an existing id, else appends', () => {
    expect(upsertById([ov(1)], ov(1, { layer: 5 }))[0].layer).toBe(5)
    expect(upsertById([ov(1)], ov(2)).map((o) => o.id)).toEqual([1, 2])
  })
  it('sortByLayer sorts ascending', () => {
    expect(sortByLayer([ov(1, { layer: 3 }), ov(2, { layer: 1 })]).map((o) => o.id)).toEqual([2, 1])
  })
  it('filterByDisplay: no filter shows only empty display_filter', () => {
    const set = [ov(1, { displayFilter: null }), ov(2, { displayFilter: '2' }), ov(3, { displayFilter: '' })]
    expect(filterByDisplay(set, null).map((o) => o.id)).toEqual([1, 3])
    expect(filterByDisplay(set, '2').map((o) => o.id)).toEqual([2])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- liveReducer`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement types**

`lib/broadcast/types.ts`:
```ts
export type Channel = 'preview' | 'air'

export type OverlayPayload = {
  id: number
  model: string
  category: string | null
  template: string | null
  layer: number
  displayFilter: string | null
  isFullscreen: boolean
  data: { widget: Record<string, unknown> }
}

export type BroadcastEvent =
  | { type: 'air'; data: OverlayPayload[] }
  | { type: 'preview'; data: OverlayPayload[] }
  | { type: 'hide'; data: { id: number } }
  | { type: 'hide_all' }
  | { type: 'live_update'; data: { id: number; widget: Record<string, unknown> } }
```

- [ ] **Step 4: Implement the reducer**

`lib/broadcast/liveReducer.ts`:
```ts
import type { BroadcastEvent, OverlayPayload } from './types'

export function upsertById(set: OverlayPayload[], item: OverlayPayload): OverlayPayload[] {
  const i = set.findIndex((o) => o.id === item.id)
  if (i === -1) return [...set, item]
  const next = set.slice()
  next[i] = item
  return next
}

export function applyEvent(set: OverlayPayload[], e: BroadcastEvent): OverlayPayload[] {
  switch (e.type) {
    case 'air':
    case 'preview':
      return e.data
    case 'hide':
      return set.filter((o) => o.id !== e.data.id)
    case 'hide_all':
      return []
    case 'live_update':
      return set.map((o) => (o.id === e.data.id
        ? { ...o, data: { ...o.data, widget: { ...o.data.widget, ...e.data.widget } } }
        : o))
    default:
      return set
  }
}

export function sortByLayer(set: OverlayPayload[]): OverlayPayload[] {
  return set.slice().sort((a, b) => a.layer - b.layer)
}

export function filterByDisplay(set: OverlayPayload[], filter: string | null): OverlayPayload[] {
  if (!filter) return set.filter((o) => !o.displayFilter)
  return set.filter((o) => o.displayFilter === filter)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- liveReducer`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/broadcast/types.ts lib/broadcast/liveReducer.ts test/broadcast/liveReducer.test.ts
git commit -m "feat(broadcast): event types + pure live reducer"
```

---

### Task 3: In-process bus

**Files:**
- Create: `lib/broadcast/bus.ts`
- Test: `test/broadcast/bus.test.ts`

**Interfaces:**
- Consumes: `applyEvent` (Task 2); `Channel`, `BroadcastEvent`, `OverlayPayload`.
- Produces:
  - `publish(uuid: string, channel: Channel, event: BroadcastEvent): void`
  - `subscribe(uuid: string, channel: Channel, cb: (e: BroadcastEvent) => void): () => void`
  - `getSnapshot(uuid: string, channel: Channel): OverlayPayload[]`
  - `resetBus(): void` (test helper)

- [ ] **Step 1: Write the failing test**

`test/broadcast/bus.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  publish, subscribe, getSnapshot, resetBus,
} from '@/lib/broadcast/bus'
import type { OverlayPayload } from '@/lib/broadcast/types'

const ov: OverlayPayload = {
  id: 1, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}

describe('broadcast bus', () => {
  beforeEach(() => resetBus())

  it('delivers events to subscribers of the same key', () => {
    const seen: string[] = []
    subscribe('u1', 'air', (e) => seen.push(e.type))
    publish('u1', 'air', { type: 'air', data: [ov] })
    expect(seen).toEqual(['air'])
  })
  it('does not cross channels or uuids', () => {
    const seen: string[] = []
    subscribe('u1', 'preview', (e) => seen.push(e.type))
    publish('u1', 'air', { type: 'air', data: [ov] })
    publish('u2', 'preview', { type: 'air', data: [ov] })
    expect(seen).toEqual([])
  })
  it('keeps a snapshot reduced from events (for replay)', () => {
    publish('u1', 'air', { type: 'air', data: [ov] })
    expect(getSnapshot('u1', 'air').map((o) => o.id)).toEqual([1])
    publish('u1', 'air', { type: 'hide_all' })
    expect(getSnapshot('u1', 'air')).toEqual([])
  })
  it('unsubscribe stops delivery', () => {
    const seen: string[] = []
    const off = subscribe('u1', 'air', (e) => seen.push(e.type))
    off()
    publish('u1', 'air', { type: 'hide_all' })
    expect(seen).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- bus`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the bus**

`lib/broadcast/bus.ts`:
```ts
import { applyEvent } from './liveReducer'
import type { BroadcastEvent, Channel, OverlayPayload } from './types'

type Entry = { subs: Set<(e: BroadcastEvent) => void>; snapshot: OverlayPayload[] }
const channels = new Map<string, Entry>()

function keyOf(uuid: string, channel: Channel) {
  return `${uuid}:${channel}`
}
function ensure(uuid: string, channel: Channel): Entry {
  const k = keyOf(uuid, channel)
  let e = channels.get(k)
  if (!e) {
    e = { subs: new Set(), snapshot: [] }
    channels.set(k, e)
  }
  return e
}

export function publish(uuid: string, channel: Channel, event: BroadcastEvent): void {
  const e = ensure(uuid, channel)
  e.snapshot = applyEvent(e.snapshot, event)
  for (const cb of e.subs) cb(event)
}

export function subscribe(uuid: string, channel: Channel, cb: (e: BroadcastEvent) => void): () => void {
  const e = ensure(uuid, channel)
  e.subs.add(cb)
  return () => e.subs.delete(cb)
}

export function getSnapshot(uuid: string, channel: Channel): OverlayPayload[] {
  return ensure(uuid, channel).snapshot
}

export function resetBus(): void {
  channels.clear()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- bus`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/bus.ts test/broadcast/bus.test.ts
git commit -m "feat(broadcast): in-process pub/sub bus with snapshot replay"
```

---

### Task 4: SSE stream route

**Files:**
- Create: `app/api/broadcast/[displayUuid]/stream/route.ts`
- Test: `test/app/api/broadcast-stream.test.ts`

**Interfaces:**
- Consumes: `subscribe`, `getSnapshot` (Task 3).
- Produces: `GET` handler streaming `text/event-stream`; `export const runtime = 'nodejs'`.

- [ ] **Step 1: Write the failing test**

`test/app/api/broadcast-stream.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/broadcast/[displayUuid]/stream/route'
import { publish, resetBus } from '@/lib/broadcast/bus'
import type { OverlayPayload } from '@/lib/broadcast/types'

const ov: OverlayPayload = {
  id: 1, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}
const P = (displayUuid: string) => ({ params: Promise.resolve({ displayUuid }) })

describe('GET broadcast stream', () => {
  beforeEach(() => resetBus())

  it('is an event-stream that replays the current snapshot on connect', async () => {
    publish('u1', 'air', { type: 'air', data: [ov] })
    const req = new Request('http://localhost/api/broadcast/u1/stream?channel=air')
    const res = await GET(req, P('u1'))
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('event: air')
    expect(text).toContain('"id":1')
    await reader.cancel()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- broadcast-stream`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the route**

`app/api/broadcast/[displayUuid]/stream/route.ts`:
```ts
import { getSnapshot, subscribe } from '@/lib/broadcast/bus'
import type { BroadcastEvent, Channel } from '@/lib/broadcast/types'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ displayUuid: string }> }) {
  const { displayUuid } = await params
  const channel: Channel = new URL(req.url).searchParams.get('channel') === 'air' ? 'air' : 'preview'

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (type: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      // Replay the current set as one channel event, then stream live ones.
      send(channel, getSnapshot(displayUuid, channel))
      const unsub = subscribe(displayUuid, channel, (e: BroadcastEvent) => {
        send(e.type, 'data' in e ? e.data : {})
      })
      req.signal.addEventListener('abort', () => {
        unsub()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- broadcast-stream`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/broadcast/[displayUuid]/stream/route.ts" test/app/api/broadcast-stream.test.ts
git commit -m "feat(broadcast): Node SSE stream route with snapshot replay"
```

---

### Task 5: Displays CRUD routes + RTK api

**Files:**
- Create: `app/api/projects/[projectId]/displays/route.ts` (GET list, POST create)
- Create: `app/api/projects/[projectId]/displays/[displayId]/route.ts` (DELETE)
- Create: `store/apis/displaysApi.ts`
- Modify: `store/index.ts` (register)
- Test: `test/app/api/displays.test.ts`

**Interfaces:**
- Consumes: `requireSession`; `displays` table; `createDisplaySchema` (Task 1).
- Produces: REST `GET/POST /api/projects/[projectId]/displays`, `DELETE …/[displayId]`; `displaysApi` with `useListDisplaysQuery`, `useCreateDisplayMutation`, `useDeleteDisplayMutation`; `Display = { id; uuid; name; projectId }`.

- [ ] **Step 1: Write the failing test**

`test/app/api/displays.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn(), insert: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const list = await import('@/app/api/projects/[projectId]/displays/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

describe('displays routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST 400 on empty name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await list.POST(body({ name: '' }), P({ projectId: '3' }))
    expect(res.status).toBe(400)
  })
  it('POST inserts under the URL projectId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1, uuid: 'x', name: 'Main', projectId: 3 }]) })
    dbMock.insert.mockReturnValue({ values })
    const res = await list.POST(body({ name: 'Main' }), P({ projectId: '3' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'Main', projectId: 3 }))
  })
  it('GET 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await list.GET(new Request('http://localhost/x'), P({ projectId: '3' }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- displays.test`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the list/create route**

`app/api/projects/[projectId]/displays/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { createDisplaySchema } from '@/db/schemas/displays'
import { requireSession } from '@/lib/crud/requireSession'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const rows = await db.select().from(displays).where(eq(displays.projectId, Number(projectId)))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const parsed = createDisplaySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(displays).values({ name: parsed.data.name, projectId: Number(projectId) }).returning()
  return Response.json(row, { status: 201 })
}
```

- [ ] **Step 4: Implement the delete route**

`app/api/projects/[projectId]/displays/[displayId]/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'

export const runtime = 'nodejs'

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  await db.delete(displays).where(eq(displays.id, Number(displayId)))
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 5: Implement the RTK api + register**

`store/apis/displaysApi.ts`:
```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Display = { id: number; uuid: string; name: string; projectId: number }

export const displaysApi = createApi({
  reducerPath: 'displaysApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Display'],
  endpoints: (b) => ({
    listDisplays: b.query<Display[], string>({
      query: (projectId) => `/projects/${projectId}/displays`,
      providesTags: (_r, _e, projectId) => [{ type: 'Display', id: `LIST:${projectId}` }],
    }),
    createDisplay: b.mutation<Display, { projectId: string; name: string }>({
      query: ({ projectId, name }) => ({ url: `/projects/${projectId}/displays`, method: 'POST', body: { name } }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Display', id: `LIST:${projectId}` }],
    }),
    deleteDisplay: b.mutation<void, { projectId: string; displayId: number }>({
      query: ({ projectId, displayId }) => ({ url: `/projects/${projectId}/displays/${displayId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Display', id: `LIST:${projectId}` }],
    }),
  }),
})

export const { useListDisplaysQuery, useCreateDisplayMutation, useDeleteDisplayMutation } = displaysApi
```

In `store/index.ts`: import `displaysApi`, add `[displaysApi.reducerPath]: displaysApi.reducer` to `rootReducer` and `displaysApi.middleware` to `entityMiddleware`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- displays.test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add "app/api/projects/[projectId]/displays" store/apis/displaysApi.ts store/index.ts test/app/api/displays.test.ts
git commit -m "feat(broadcast): displays CRUD routes + RTK api"
```

---

### Task 6: Settings routes + RTK api

**Files:**
- Create: `app/api/settings/route.ts` (GET current user's settings, PUT active display)
- Create: `store/apis/settingsApi.ts`
- Modify: `store/index.ts` (register)
- Test: `test/app/api/settings.test.ts`

**Interfaces:**
- Consumes: `auth` (session → user id); `settings` table; `setSettingsSchema` (Task 1).
- Produces: `GET/PUT /api/settings`; `settingsApi` with `useGetSettingsQuery`, `useSetSettingsMutation`; `Settings = { userId: string; displayId: number | null }`.

- [ ] **Step 1: Write the failing test**

`test/app/api/settings.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/settings/route')
const put = (o: unknown) => new Request('http://localhost/api/settings', { method: 'PUT', body: JSON.stringify(o) })

describe('settings routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await route.GET(new Request('http://localhost/api/settings'))).status).toBe(401)
  })
  it('PUT upserts the active display for the session user', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ userId: 'u1', displayId: 7 }]) })
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    dbMock.insert.mockReturnValue({ values })
    const res = await route.PUT(put({ displayId: 7 }))
    expect(res.status).toBe(200)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', displayId: 7 }))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- settings.test`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the route**

`app/api/settings/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { setSettingsSchema } from '@/db/schemas/displays'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'

async function userId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  return session?.user?.id ?? null
}

export async function GET(req: Request) {
  const uid = await userId(req)
  if (!uid) return new Response('Unauthorized', { status: 401 })
  const [row] = await db.select().from(settings).where(eq(settings.userId, uid))
  return Response.json(row ?? { userId: uid, displayId: null })
}

export async function PUT(req: Request) {
  const uid = await userId(req)
  if (!uid) return new Response('Unauthorized', { status: 401 })
  const parsed = setSettingsSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(settings)
    .values({ userId: uid, displayId: parsed.data.displayId })
    .onConflictDoUpdate({ target: settings.userId, set: { displayId: parsed.data.displayId, updatedAt: new Date() } })
    .returning()
  return Response.json(row)
}
```

- [ ] **Step 4: Implement the RTK api + register**

`store/apis/settingsApi.ts`:
```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Settings = { userId: string; displayId: number | null }

export const settingsApi = createApi({
  reducerPath: 'settingsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Settings'],
  endpoints: (b) => ({
    getSettings: b.query<Settings, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),
    setSettings: b.mutation<Settings, { displayId: number | null }>({
      query: (body) => ({ url: '/settings', method: 'PUT', body }),
      invalidatesTags: ['Settings'],
    }),
  }),
})

export const { useGetSettingsQuery, useSetSettingsMutation } = settingsApi
```

In `store/index.ts`: register `settingsApi` (reducer + middleware), same as Task 5.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- settings.test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/settings store/apis/settingsApi.ts store/index.ts test/app/api/settings.test.ts
git commit -m "feat(broadcast): per-user settings (active display) route + RTK api"
```

---

### Task 7: Payload helper + preview/air publisher routes

**Files:**
- Create: `lib/broadcast/payload.ts`
- Create: `app/api/projects/[projectId]/broadcast/[displayId]/preview/route.ts`
- Create: `app/api/projects/[projectId]/broadcast/[displayId]/air/route.ts`
- Test: `test/app/api/broadcast-publish.test.ts`

**Interfaces:**
- Consumes: `requireSession`; `db`, `displays`, `rundownOverlays`; `publish`, `getSnapshot` (Task 3); `upsertById` (Task 2); `toOverlayPayload` (this task).
- Produces:
  - `toOverlayPayload(row): OverlayPayload` — maps a `rundown_overlays` select row to an `OverlayPayload`.
  - `POST …/broadcast/[displayId]/preview` `{ overlayId }`
  - `POST …/broadcast/[displayId]/air` `{ overlayId }` (full-screen clears air first)

- [ ] **Step 1: Write the failing test**

`test/app/api/broadcast-publish.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSnapshot, resetBus } from '@/lib/broadcast/bus'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const preview = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/preview/route')
const air = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/air/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

// db.select() is called twice per handler: display lookup then overlay lookup.
function mockLookups(display: unknown, overlay: unknown) {
  dbMock.select
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([display]) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([overlay]) }) })
}
const overlayRow = {
  id: 9, model: 'general-text', category: 'general', template: 'Text', layer: 2,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}

describe('preview/air publisher routes', () => {
  beforeEach(() => { vi.clearAllMocks(); resetBus(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('preview publishes the overlay onto the display preview snapshot', async () => {
    mockLookups({ id: 4, uuid: 'disp-uuid' }, overlayRow)
    const res = await preview.POST(body({ overlayId: 9 }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('disp-uuid', 'preview').map((o) => o.id)).toEqual([9])
  })
  it('air with a full-screen overlay clears the air set first', async () => {
    mockLookups({ id: 4, uuid: 'disp-uuid' }, { ...overlayRow, isFullscreen: true })
    const res = await air.POST(body({ overlayId: 9 }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('disp-uuid', 'air').map((o) => o.id)).toEqual([9])
  })
  it('air 404 when the display is missing', async () => {
    mockLookups(undefined, overlayRow)
    const res = await air.POST(body({ overlayId: 9 }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- broadcast-publish`
Expected: FAIL — routes not found.

- [ ] **Step 3: Implement the payload helper**

`lib/broadcast/payload.ts`:
```ts
import type { OverlayPayload } from './types'

type Row = {
  id: number
  model: string
  category: string | null
  template: string | null
  layer: number
  displayFilter: string | null
  isFullscreen: boolean
  data: { widget: Record<string, unknown> }
}

export function toOverlayPayload(row: Row): OverlayPayload {
  return {
    id: row.id,
    model: row.model,
    category: row.category,
    template: row.template,
    layer: row.layer,
    displayFilter: row.displayFilter,
    isFullscreen: row.isFullscreen,
    data: { widget: row.data?.widget ?? {} },
  }
}
```

- [ ] **Step 4: Implement the preview route**

`app/api/projects/[projectId]/broadcast/[displayId]/preview/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { getSnapshot, publish } from '@/lib/broadcast/bus'
import { upsertById } from '@/lib/broadcast/liveReducer'
import { toOverlayPayload } from '@/lib/broadcast/payload'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { overlayId } = await req.json() as { overlayId: number }

  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const set = upsertById(getSnapshot(display.uuid, 'preview'), toOverlayPayload(overlay))
  publish(display.uuid, 'preview', { type: 'preview', data: set })
  return new Response(null, { status: 200 })
}
```

- [ ] **Step 5: Implement the air route**

`app/api/projects/[projectId]/broadcast/[displayId]/air/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { getSnapshot, publish } from '@/lib/broadcast/bus'
import { upsertById } from '@/lib/broadcast/liveReducer'
import { toOverlayPayload } from '@/lib/broadcast/payload'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { overlayId } = await req.json() as { overlayId: number }

  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const payload = toOverlayPayload(overlay)
  // Full-screen take clears the current air set first (the take rule).
  const base = payload.isFullscreen ? [] : getSnapshot(display.uuid, 'air')
  publish(display.uuid, 'air', { type: 'air', data: upsertById(base, payload) })
  return new Response(null, { status: 200 })
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- broadcast-publish`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/broadcast/payload.ts "app/api/projects/[projectId]/broadcast/[displayId]/preview" "app/api/projects/[projectId]/broadcast/[displayId]/air" test/app/api/broadcast-publish.test.ts
git commit -m "feat(broadcast): payload helper + preview/air publisher routes"
```

---

### Task 8: hide / hide_all / live_update publisher routes

**Files:**
- Create: `app/api/projects/[projectId]/broadcast/[displayId]/hide/route.ts`
- Create: `app/api/projects/[projectId]/broadcast/[displayId]/hide_all/route.ts`
- Create: `app/api/projects/[projectId]/broadcast/[displayId]/live_update/route.ts`
- Test: `test/app/api/broadcast-hide-update.test.ts`

**Interfaces:**
- Consumes: `requireSession`; `db`, `displays`, `rundownOverlays`; `publish` (Task 3); `describeModel` from `@/lib/overlays/catalog` (for `can_live_update` field names).
- Produces: `POST …/hide` `{ overlayId, channel }`, `POST …/hide_all` `{ channel }`, `POST …/live_update` `{ overlayId, widget }`.

- [ ] **Step 1: Write the failing test**

`test/app/api/broadcast-hide-update.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publish, getSnapshot, resetBus } from '@/lib/broadcast/bus'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const hide = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/hide/route')
const hideAll = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/hide_all/route')
const liveUpdate = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/live_update/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

const ov = {
  id: 9, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}
function mockDisplay() {
  dbMock.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ id: 4, uuid: 'disp-uuid' }]) }) })
}

describe('hide/hide_all/live_update routes', () => {
  beforeEach(() => { vi.clearAllMocks(); resetBus(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('hide removes the overlay from the air snapshot', async () => {
    publish('disp-uuid', 'air', { type: 'air', data: [ov] })
    mockDisplay()
    const res = await hide.POST(body({ overlayId: 9, channel: 'air' }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('disp-uuid', 'air')).toEqual([])
  })
  it('hide_all clears the channel', async () => {
    publish('disp-uuid', 'air', { type: 'air', data: [ov] })
    mockDisplay()
    await hideAll.POST(body({ channel: 'air' }), P({ projectId: '3', displayId: '4' }))
    expect(getSnapshot('disp-uuid', 'air')).toEqual([])
  })
  it('live_update publishes only can_live_update fields (general-text.text is live)', async () => {
    publish('disp-uuid', 'air', { type: 'air', data: [ov] })
    dbMock.select
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 4, uuid: 'disp-uuid' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ model: 'general-text' }]) }) })
    const res = await liveUpdate.POST(body({ overlayId: 9, widget: { text: 'new' } }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('disp-uuid', 'air')[0].data.widget).toEqual({ text: 'new' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- broadcast-hide-update`
Expected: FAIL — routes not found.

- [ ] **Step 3: Implement the hide route**

`app/api/projects/[projectId]/broadcast/[displayId]/hide/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { publish } from '@/lib/broadcast/bus'
import type { Channel } from '@/lib/broadcast/types'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { overlayId, channel } = await req.json() as { overlayId: number; channel: Channel }
  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  publish(display.uuid, channel === 'preview' ? 'preview' : 'air', { type: 'hide', data: { id: Number(overlayId) } })
  return new Response(null, { status: 200 })
}
```

- [ ] **Step 4: Implement the hide_all route**

`app/api/projects/[projectId]/broadcast/[displayId]/hide_all/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { publish } from '@/lib/broadcast/bus'
import type { Channel } from '@/lib/broadcast/types'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { channel } = await req.json() as { channel: Channel }
  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  publish(display.uuid, channel === 'preview' ? 'preview' : 'air', { type: 'hide_all' })
  return new Response(null, { status: 200 })
}
```

- [ ] **Step 5: Implement the live_update route**

`app/api/projects/[projectId]/broadcast/[displayId]/live_update/route.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { publish } from '@/lib/broadcast/bus'
import { describeModel } from '@/lib/overlays/catalog'

export const runtime = 'nodejs'

// Publishes a live_update on BOTH channels (an overlay may be on preview and/or
// air); the renderer merges by id where present. Only can_live_update fields pass.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { overlayId, widget } = await req.json() as { overlayId: number; widget: Record<string, unknown> }

  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const liveFields = new Set(describeModel(overlay.model).filter((f) => f.can_live_update).map((f) => f.name))
  const filtered = Object.fromEntries(Object.entries(widget).filter(([k]) => liveFields.has(k)))
  const data = { id: Number(overlayId), widget: filtered }
  publish(display.uuid, 'preview', { type: 'live_update', data })
  publish(display.uuid, 'air', { type: 'live_update', data })
  return new Response(null, { status: 200 })
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- broadcast-hide-update`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add "app/api/projects/[projectId]/broadcast/[displayId]/hide" "app/api/projects/[projectId]/broadcast/[displayId]/hide_all" "app/api/projects/[projectId]/broadcast/[displayId]/live_update" test/app/api/broadcast-hide-update.test.ts
git commit -m "feat(broadcast): hide/hide_all/live_update publisher routes"
```

---

### Task 9: Renderer — `(broadcast)` group, channel hook, canvas, preview/air pages

**Files:**
- Create: `app/(broadcast)/layout.tsx`
- Create: `lib/broadcast/useBroadcastChannel.ts`
- Create: `components/broadcast/OverlayCanvas.tsx`
- Create: `app/(broadcast)/preview/[displayUuid]/page.tsx`
- Create: `app/(broadcast)/air/[displayUuid]/page.tsx`
- Test: `test/components/broadcast/OverlayCanvas.test.tsx`

**Interfaces:**
- Consumes: `applyEvent`, `sortByLayer`, `filterByDisplay` (Task 2); `getOverlayRender` from `@/lib/overlays/render`; `OverlayPayload` (Task 2).
- Produces:
  - `useBroadcastChannel(uuid: string, channel: Channel, filter: string | null): OverlayPayload[]` — EventSource + reducer, layer-sorted + display-filtered, held across reconnect.
  - `OverlayCanvas({ overlays }: { overlays: OverlayPayload[] })` — renders each via the registry at `zIndex: layer`, animates in on mount / out on removal.

- [ ] **Step 1: Write the failing test (canvas renders a set)**

`test/components/broadcast/OverlayCanvas.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayCanvas } from '@/components/broadcast/OverlayCanvas'
import type { OverlayPayload } from '@/lib/broadcast/types'

const text = (id: number, t: string): OverlayPayload => ({
  id, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: t } },
})

describe('OverlayCanvas', () => {
  it('renders one overlay component per payload', () => {
    render(<OverlayCanvas overlays={[text(1, 'Hello'), text(2, 'World')]} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
  })
  it('renders nothing for an empty set', () => {
    const { container } = render(<OverlayCanvas overlays={[]} />)
    expect(container.textContent).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- OverlayCanvas`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the canvas**

`components/broadcast/OverlayCanvas.tsx`:
```tsx
'use client'
import { useEffect, useRef } from 'react'
import { getOverlayRender } from '@/lib/overlays/render'
import type { OverlayPayload } from '@/lib/broadcast/types'

function OverlayHost({ overlay }: { overlay: OverlayPayload }) {
  const ref = useRef<HTMLDivElement>(null)
  const entry = getOverlayRender(overlay.model)
  useEffect(() => {
    if (ref.current && entry) entry.animationIn(ref.current)
  }, [entry])
  if (!entry) return null
  const { Component } = entry
  return (
    <div ref={ref}
      style={{ position: 'absolute', inset: 0, zIndex: overlay.layer }}>
      <Component data={overlay.data} />
    </div>
  )
}

export function OverlayCanvas({ overlays }: { overlays: OverlayPayload[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, width: 1920, height: 1080, overflow: 'hidden' }}>
      {overlays.map((o) => <OverlayHost key={o.id}
        overlay={o} />)}
    </div>
  )
}
```

- [ ] **Step 4: Run the canvas test to verify it passes**

Run: `npm run test -- OverlayCanvas`
Expected: PASS (2 tests). (GSAP runs harmlessly in jsdom.)

- [ ] **Step 5: Implement the channel hook**

`lib/broadcast/useBroadcastChannel.ts`:
```ts
'use client'
import { useEffect, useRef, useState } from 'react'
import { applyEvent, filterByDisplay, sortByLayer } from './liveReducer'
import type { BroadcastEvent, Channel, OverlayPayload } from './types'

export function useBroadcastChannel(uuid: string, channel: Channel, filter: string | null): OverlayPayload[] {
  const [set, setSet] = useState<OverlayPayload[]>([])
  const ref = useRef<OverlayPayload[]>([])

  useEffect(() => {
    const apply = (e: BroadcastEvent) => {
      ref.current = applyEvent(ref.current, e)
      setSet(ref.current)
    }
    const sse = new EventSource(`/api/broadcast/${uuid}/stream?channel=${channel}`)
    const onSet = (ev: MessageEvent) => apply({ type: channel, data: JSON.parse(ev.data) })
    sse.addEventListener('air', onSet)
    sse.addEventListener('preview', onSet)
    sse.addEventListener('hide', (ev) => apply({ type: 'hide', data: JSON.parse((ev as MessageEvent).data) }))
    sse.addEventListener('hide_all', () => apply({ type: 'hide_all' }))
    sse.addEventListener('live_update', (ev) => apply({ type: 'live_update', data: JSON.parse((ev as MessageEvent).data) }))
    return () => sse.close()
  }, [uuid, channel])

  return sortByLayer(filterByDisplay(set, filter))
}
```

- [ ] **Step 6: Implement the transparent layout + pages**

`app/(broadcast)/layout.tsx`:
```tsx
export const metadata = { title: 'ETS Broadcast' }

// Second root layout (no app/layout.tsx). Genuinely transparent, MUI-free — OBS
// needs a transparent canvas, so no CssBaseline painting <body>.
export default function BroadcastLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'transparent' }}>
        {children}
      </body>
    </html>
  )
}
```

`app/(broadcast)/air/[displayUuid]/page.tsx`:
```tsx
'use client'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBroadcastChannel } from '@/lib/broadcast/useBroadcastChannel'
import { OverlayCanvas } from '@/components/broadcast/OverlayCanvas'

export default function AirPage({ params }: { params: Promise<{ displayUuid: string }> }) {
  const { displayUuid } = use(params)
  const filter = useSearchParams().get('filter')
  const overlays = useBroadcastChannel(displayUuid, 'air', filter)
  return <OverlayCanvas overlays={overlays} />
}
```

`app/(broadcast)/preview/[displayUuid]/page.tsx`: identical, with `'preview'` instead of `'air'`.

- [ ] **Step 7: Verify build sees both root layouts (run dev, not just build)**

Run: `npm run test -- OverlayCanvas` (still green), then `npx tsc --noEmit` (clean). Full route validation happens in Task 11's `next dev` smoke — a clean `next build` alone can miss route-group issues.

- [ ] **Step 8: Commit**

```bash
git add "app/(broadcast)" lib/broadcast/useBroadcastChannel.ts components/broadcast/OverlayCanvas.tsx test/components/broadcast/OverlayCanvas.test.tsx
git commit -m "feat(broadcast): transparent renderer pages + channel hook + overlay canvas"
```

---

### Task 10: Controller UI + broadcast RTK api

**Files:**
- Create: `store/apis/broadcastApi.ts`
- Modify: `store/index.ts` (register)
- Create: `app/(admin)/projects/[projectId]/rundowns/[rundownId]/controller/page.tsx`
- Modify: `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx` (add a "Controller" link)

**Interfaces:**
- Consumes: `useListDisplaysQuery`, `useCreateDisplayMutation` (Task 5); `useGetSettingsQuery`, `useSetSettingsMutation` (Task 6); `useListRundownOverlaysQuery` (existing); `broadcastApi` (this task).
- Produces: `broadcastApi` with `usePreviewMutation`, `useAirMutation`, `useHideMutation`, `useHideAllMutation`, `useLiveUpdateMutation`. This is an integration task — no unit test; verified by typecheck + build + the Task 11 browser smoke.

- [ ] **Step 1: Implement the broadcast RTK api + register**

`store/apis/broadcastApi.ts`:
```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

type Ctx = { projectId: string; displayId: number }

export const broadcastApi = createApi({
  reducerPath: 'broadcastApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    preview: b.mutation<void, Ctx & { overlayId: number }>({
      query: ({ projectId, displayId, overlayId }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/preview`, method: 'POST', body: { overlayId },
      }),
    }),
    air: b.mutation<void, Ctx & { overlayId: number }>({
      query: ({ projectId, displayId, overlayId }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/air`, method: 'POST', body: { overlayId },
      }),
    }),
    hide: b.mutation<void, Ctx & { overlayId: number; channel: 'preview' | 'air' }>({
      query: ({ projectId, displayId, overlayId, channel }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/hide`, method: 'POST', body: { overlayId, channel },
      }),
    }),
    hideAll: b.mutation<void, Ctx & { channel: 'preview' | 'air' }>({
      query: ({ projectId, displayId, channel }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/hide_all`, method: 'POST', body: { channel },
      }),
    }),
    liveUpdate: b.mutation<void, Ctx & { overlayId: number; widget: Record<string, unknown> }>({
      query: ({ projectId, displayId, overlayId, widget }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/live_update`, method: 'POST', body: { overlayId, widget },
      }),
    }),
  }),
})

export const {
  usePreviewMutation, useAirMutation, useHideMutation, useHideAllMutation, useLiveUpdateMutation,
} = broadcastApi
```

Register `broadcastApi` in `store/index.ts` (reducer + middleware).

- [ ] **Step 2: Implement the controller page**

`app/(admin)/projects/[projectId]/rundowns/[rundownId]/controller/page.tsx`:
```tsx
'use client'
import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Box, Button, Card, CardContent, MenuItem, TextField, Typography, Chip,
} from '@mui/material'
import { useListRundownOverlaysQuery } from '@/store/apis/rundownOverlaysApi'
import { useListDisplaysQuery, useCreateDisplayMutation } from '@/store/apis/displaysApi'
import { useGetSettingsQuery, useSetSettingsMutation } from '@/store/apis/settingsApi'
import {
  usePreviewMutation, useAirMutation, useHideMutation, useHideAllMutation,
} from '@/store/apis/broadcastApi'

export default function ControllerPage({ params }: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: overlays = [] } = useListRundownOverlaysQuery({ projectId, rundownId })
  const { data: displays = [] } = useListDisplaysQuery(projectId)
  const { data: settings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()
  const [createDisplay] = useCreateDisplayMutation()
  const [preview] = usePreviewMutation()
  const [air] = useAirMutation()
  const [hide] = useHideMutation()
  const [hideAll] = useHideAllMutation()

  const [displayId, setDisplayId] = useState<number | null>(null)
  useEffect(() => {
    if (displayId == null && settings?.displayId) setDisplayId(settings.displayId)
    else if (displayId == null && displays.length) setDisplayId(displays[0].id)
  }, [settings, displays, displayId])

  const display = displays.find((d) => d.id === displayId) ?? null

  async function pickDisplay(id: number) {
    setDisplayId(id)
    await setSettings({ displayId: id })
  }
  async function addDisplay() {
    const created = await createDisplay({ projectId, name: `Display ${displays.length + 1}` }).unwrap()
    await pickDisplay(created.id)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Button component={Link}
        href={`/projects/${projectId}/rundowns/${rundownId}`}
        size="small">
        ← Editor
      </Button>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', my: 2 }}>
        <TextField select
          label="Display"
          size="small"
          value={displayId ?? ''}
          onChange={(e) => pickDisplay(Number(e.target.value))}
          sx={{ minWidth: 200 }}>
          {displays.map((d) => <MenuItem key={d.id}
            value={d.id}>
            {d.name}
          </MenuItem>)}
        </TextField>
        <Button onClick={addDisplay}
          variant="outlined"
          size="small">
          + Display
        </Button>
        {display ? (
          <Button color="error"
            variant="outlined"
            size="small"
            onClick={() => display && hideAll({ projectId, displayId: display.id, channel: 'air' })}>
            Hide all (air)
          </Button>
        ) : null}
      </Box>

      {!display ? (
        <Typography color="text.secondary">
          Create a display to start broadcasting.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
          <Box>
            {overlays.map((o) => (
              <Card key={o.id}
                sx={{ mb: 1 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small"
                    label={`L${o.layer}`} />
                  <Typography sx={{ flex: 1 }}>
                    {o.widgetName}
                  </Typography>
                  <Button size="small"
                    onClick={() => preview({ projectId, displayId: display.id, overlayId: o.id })}>
                    Stage
                  </Button>
                  <Button size="small"
                    variant="contained"
                    onClick={() => air({ projectId, displayId: display.id, overlayId: o.id })}>
                    Take
                  </Button>
                  <Button size="small"
                    color="error"
                    onClick={() => hide({ projectId, displayId: display.id, overlayId: o.id, channel: 'air' })}>
                    Hide
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption">
              Preview
            </Typography>
            <Box component="iframe"
              title="preview"
              src={`/preview/${display.uuid}`}
              sx={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid', borderColor: 'divider', bgcolor: '#111' }} />
            <Typography variant="caption">
              Air
            </Typography>
            <Box component="iframe"
              title="air"
              src={`/air/${display.uuid}`}
              sx={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid', borderColor: 'divider', bgcolor: '#111' }} />
          </Box>
        </Box>
      )}
    </Box>
  )
}
```

(Live-update of `can_live_update` fields is exposed here via the existing editor for MVP; the wire route from Task 8 is ready and can be surfaced with a field form in a follow-up without new backend work.)

- [ ] **Step 3: Add a "Controller" link on the editor page**

In `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`, next to the "← Rundowns" button, add:
```tsx
<Button component={Link}
  href={`/projects/${projectId}/rundowns/${rundownId}/controller`}
  size="small"
  sx={{ mb: 1, ml: 1 }}>
  Controller →
</Button>
```
(`Link` and `Button` are already imported in that file.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add store/apis/broadcastApi.ts store/index.ts "app/(admin)/projects/[projectId]/rundowns/[rundownId]/controller" "app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx"
git commit -m "feat(broadcast): controller UI (stage/take/hide + iframe monitors) + broadcast api"
```

---

### Task 11: Green gate + docs + browser smoke

**Files:**
- Modify: `docs/preview-air.md`, `docs/rundowns.md` (mark broadcast MVP live)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all pass (prior 118 + the new broadcast tests). Fix any failure before continuing.

- [ ] **Step 2: Lint**

Run: `npx eslint app components lib store test`
Expected: 0 errors (run `npx eslint --fix` on new files if formatting trips; re-run tests after).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success, listing `/preview/[displayUuid]`, `/air/[displayUuid]`, `/api/broadcast/[displayUuid]/stream`, the publisher routes, and `…/rundowns/[rundownId]/controller`.

- [ ] **Step 5: Dev-server route validation (catches route-group issues a build can miss)**

Ensure the dev server runs (`preview_start` `dev`, port 3000). Confirm it compiles with two root layouts — hit `/login` (200) and `/air/anything` (renders the transparent page, empty set) without a runtime error. The user (logged in) drives the controller: create a display, add an overlay in the editor, open the controller, Stage → Take a `general-text` overlay, and confirm the Air iframe shows it and Hide removes it. Capture a screenshot; check `read_console_messages`.

- [ ] **Step 6: Update the docs**

- In `docs/preview-air.md`, change the framing from "target design, not yet built" to note the MVP is **live** (in-process bus, Node SSE, `/preview`+`/air` set rendering, publisher routes), and that stingers/match-collection/thread-widget events remain deferred.
- In `docs/rundowns.md`, update the "Current state" note: the controller (stage/take/hide/hide_all + display picker + iframe monitors) is now live at `…/rundowns/[rundownId]/controller`; `rundown_overlay_data` + per-display authored data still deferred.

- [ ] **Step 7: Commit**

```bash
git add docs/preview-air.md docs/rundowns.md
git commit -m "docs(broadcast): mark broadcast+controller MVP live; whole-project green"
```

---

## Self-Review

**Spec coverage:**
- `displays` + minimal `settings` + one migration → Task 1. ✓
- In-process bus (keyed `uuid:channel`, snapshot) → Tasks 2 (reducer) + 3 (bus). ✓
- SSE stream route (Node, replay + stream) → Task 4. ✓
- `/preview` + `/air` renderer pages (transparent group, set, layer sort, GSAP, reconnect, display_filter) → Task 9. ✓
- Publisher routes (preview/air/hide/hide_all/live_update; full-screen clears air; projectId from URL; live-update gated to can_live_update) → Tasks 7 + 8. ✓
- Controller UI (display picker persisted, list stage/take/hide, hide_all, iframe monitors) + link → Task 10. ✓
- displays/settings/broadcast RTK apis registered → Tasks 5, 6, 10. ✓
- Node runtime everywhere → every route file sets `runtime = 'nodejs'`. ✓
- Transient state, no `rundown_overlay_data` → no such table created. ✓
- Testing (bus, reducer, SSE, publisher routes, displays/settings, canvas) + gate → Tasks 2–9, 11. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete code. The one deferral (a dedicated live-update field form in the controller) is explicitly optional — the backend route and RTK mutation exist and are tested. ✓

**Type consistency:** `OverlayPayload` shape identical across Tasks 2/3/4/7/9; `BroadcastEvent` `hide_all` has no `data` and the SSE route + hook both handle that (`'data' in e`); `Channel` used consistently; `toOverlayPayload` row shape matches the `rundown_overlays` select columns; `publish/subscribe/getSnapshot/resetBus` signatures match between Task 3 and consumers; RTK hook names (`usePreviewMutation` etc.) match their usage in Task 10; `describeModel(model)` returns `FieldDescriptor[]` with `can_live_update` (existing catalog API). ✓

**Migration note:** only one new migration (`0002`), matching the spec's "one migration only"; the user runs `db:migrate`.
