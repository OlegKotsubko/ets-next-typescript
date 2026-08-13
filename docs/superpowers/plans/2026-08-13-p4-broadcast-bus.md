# P4 — Broadcast Bus + SSE + Preview/Air Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/preview/[rundownId]` and `/air/[rundownId]` render live, so that a `publish()` call anywhere in the process shows/hides titles on those pages in real time, and a page reload recovers the current set — the plumbing P5b's controller will drive.

**Architecture:** An in-process, channel-aware pub/sub (`lib/broadcast/bus.ts`) keyed by `(rundownId, channel)`, built on a pure reducer (`lib/broadcast/liveSet.ts`) that folds `BroadcastEvent`s into a `Map<itemId, LiveTitle>`. The bus also remembers the current set per channel (`getSnapshot`), and the SSE route (`app/api/broadcast/[rundownId]/stream/route.ts`, Edge) replays that snapshot as `show` events before streaming live ones, so a reconnecting client recovers state. On the client, `useTitleStream` mirrors the exact same reducer over `EventSource` messages, and `TitleRenderer` maps the resulting array through the **shipped** title registry (`getTitleEntry` from `@/lib/titles/registry`) to render real components, stacked by `layer`. `layer`/`position` live in the `BroadcastEvent` payload itself, **not** in `rundown_items` — that column doesn't exist yet (it's Task 1 of the original multi-layer plan, deferred to P5b) and nothing in this plan touches the database.

A prerequisite falls out of the transparency requirement: `/preview` and `/air` must not inherit `app/layout.tsx`'s MUI `CssBaseline` (which paints a solid theme background on `<body>`) or its Redux `Provider`. Task 1 splits the app into two independent root layouts via Next.js route groups — `(admin)` keeps today's behavior untouched, `(broadcast)` is new and deliberately bare.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM + Neon Postgres · Vitest 4 + `@testing-library/react` (jsdom). No new dependencies.

**Design source:** `docs/superpowers/specs/2026-06-21-multi-layer-preview-air-design.md` and `docs/superpowers/plans/2026-06-21-multi-layer-preview-air.md` (Tasks 3–6 and 11 specify the `applyEvent`/`sortLiveSet`/`getSnapshot`/`BroadcastEvent`/`useTitleStream` signatures this plan implements — reuse them verbatim, don't invent parallel names, per `docs/superpowers/specs/2026-06-18-base-app-scope.md`). That plan's registry/prerequisite sketches predate P3 and are **not** authoritative — this plan uses the registry API P3 actually shipped (`getTitleEntry(packageLabel, titleKey)` from `@/lib/titles/registry`), not the fictional `@/lib/broadcast/registry` the older sketches reference.

## Global Constraints

- **No migrations.** `rundown_items.layer` does not exist and this plan does not add it — `layer`/`position` travel only inside `BroadcastEvent`/`LiveTitle`. Do not touch `db/schema.ts`.
- **Composition state is transient.** The bus lives in process memory only; nothing here is persisted. See CLAUDE.md's "Single-server pub/sub caveat."
- **Edge runtime for the SSE route only** (`export const runtime = 'edge'` on `app/api/broadcast/[rundownId]/stream/route.ts`). Every other file in this plan is default Node runtime — the broadcast layouts touch `db` directly.
- **No Redux on `/preview`/`/air`.** State derives entirely from the SSE stream via `useTitleStream`; do not add these pages to any RTK API slice or the `editor` slice.
- **`/preview/[rundownId]`, `/air/[rundownId]`, and `GET /api/broadcast/[rundownId]/stream` are public** — `proxy.ts`'s matcher (`/admin/:path*`, `/api/projects/:path*`) already excludes them; do not modify `proxy.ts` or `lib/auth-guard.ts`.
- **Asset/CSS paths use `project.label` (the package folder), never `projectId` (the UUID)** — per CLAUDE.md decision 2.
- The bus's `publish(rundownId, channel, event)` takes `rundownId` and `channel` as arguments; `BroadcastEvent` itself never carries `rundownId`.
- `command` events are fire-and-forget and are **never** part of the live set or the snapshot — `applyEvent` drops them; the (P5b) delivery of a command to a mounted title's `onCommand` handler is out of scope here.
- House ESLint style: no semicolons, 2-space indent, single quotes, `max-len` 140, one JSX prop per line, one JSX expression per line. `npm run lint` must exit 0.
- Every task ends in a commit. Work on a branch off `main` (worktree).

## File structure

```
lib/broadcast/
  liveSet.ts                # BroadcastEvent, LiveTitle, applyEvent, sortLiveSet — pure, no I/O
  bus.ts                     # publish/subscribe/getSnapshot — stateful in-process pub/sub, built on liveSet
  getBroadcastContext.ts     # rundown + project.label + project_css lookup, shared by both layouts
  useTitleStream.ts          # client hook: EventSource -> applyEvent -> sortLiveSet -> LiveTitle[]
  TitleRenderer.tsx           # LiveTitle[] -> real title components, via lib/titles/registry
  PackageLabelContext.tsx     # carries packageLabel from the (server) layout down to the (client) page

app/api/broadcast/[rundownId]/stream/route.ts   # Edge SSE: replay snapshot, then live events + heartbeat

app/(admin)/...                # everything that exists today under app/, moved as-is (Task 1)
app/(broadcast)/layout.tsx                       # new bare root layout: <html><body> only, transparent
app/(broadcast)/preview/[rundownId]/layout.tsx   # fetch context, load project.css, provide packageLabel
app/(broadcast)/preview/[rundownId]/page.tsx     # useTitleStream(id, 'preview') -> TitleRenderer
app/(broadcast)/air/[rundownId]/layout.tsx        # same as preview's layout, channel is the only difference
app/(broadcast)/air/[rundownId]/page.tsx          # useTitleStream(id, 'air') -> TitleRenderer
```

---

### Task 1: Split the root layout — `(admin)` route group

Prerequisite plumbing, not new behavior: gives `/preview` and `/air` (Task 8) somewhere to attach a second, independent root layout without inheriting MUI's `CssBaseline` or the Redux `Provider`. Next.js allows exactly one root layout per top-level route group; today there's a single implicit one at `app/layout.tsx` wrapping everything. This task moves it under an explicit `(admin)` group — a pure file move, no behavior or URL changes (route groups are invisible in the URL).

**Files:**
- Move: `app/layout.tsx` → `app/(admin)/layout.tsx`
- Move: `app/providers.tsx` → `app/(admin)/providers.tsx`
- Move: `app/page.tsx` → `app/(admin)/page.tsx`
- Move: `app/admin/` → `app/(admin)/admin/` (whole subtree)
- Move: `app/login/` → `app/(admin)/login/` (whole subtree)
- Move: `app/dev/` → `app/(admin)/dev/` (whole subtree)
- Modify: `test/app/admin.test.tsx`, `test/app/login.test.tsx`, `test/app/title-preview.test.tsx` (import paths only)
- Test: no new test file — the existing suite is the regression check.

**Interfaces:**
- Consumes: nothing.
- Produces: no new exports. Public URLs are unchanged (`/`, `/login`, `/admin`, `/admin/[projectId]/...`, `/dev/title-preview`) — later tasks don't depend on anything from this one beyond "the admin app still works."

- [ ] **Step 1: Capture the baseline route table**

Run: `npm run build`
Record the `Route (app)` table from the output — you'll diff Step 5's table against it.

- [ ] **Step 2: Move the files**

```bash
mkdir -p "app/(admin)"
git mv app/layout.tsx "app/(admin)/layout.tsx"
git mv app/providers.tsx "app/(admin)/providers.tsx"
git mv app/page.tsx "app/(admin)/page.tsx"
git mv app/admin "app/(admin)/admin"
git mv app/login "app/(admin)/login"
git mv app/dev "app/(admin)/dev"
```

No file content needs to change: `app/(admin)/layout.tsx`'s `import { Providers } from './providers'` still resolves, because `providers.tsx` moved into the same folder alongside it.

- [ ] **Step 3: Fix the three test files' import paths**

In `test/app/admin.test.tsx`:
```diff
-import AdminPage from '@/app/admin/page'
-import SignOutButton from '@/app/admin/SignOutButton'
+import AdminPage from '@/app/(admin)/admin/page'
+import SignOutButton from '@/app/(admin)/admin/SignOutButton'
```

In `test/app/login.test.tsx`:
```diff
-import LoginPage from '@/app/login/page'
-import LoginForm from '@/app/login/LoginForm'
-import { loginSchema } from '@/app/login/schema'
+import LoginPage from '@/app/(admin)/login/page'
+import LoginForm from '@/app/(admin)/login/LoginForm'
+import { loginSchema } from '@/app/(admin)/login/schema'
```

In `test/app/title-preview.test.tsx`:
```diff
-import TitlePreviewPage, { SAMPLE_DATA } from '@/app/dev/title-preview/page'
+import TitlePreviewPage, { SAMPLE_DATA } from '@/app/(admin)/dev/title-preview/page'
```

- [ ] **Step 4: Run the full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green — same test count as before the move.

- [ ] **Step 5: Diff the route table**

Compare the new `npm run build` route table against Step 1's. Expected: identical set of public paths (`/`, `/login`, `/admin`, `/admin/[projectId]/...`, `/dev/title-preview`, plus the unchanged `/api/*` routes) — only the underlying file paths moved.

- [ ] **Step 6: Commit**

```bash
git add app test/app/admin.test.tsx test/app/login.test.tsx test/app/title-preview.test.tsx
git commit -m "refactor(app): move the app into an (admin) route group

Prerequisite for P4's /preview and /air pages, which need their own root
layout without MUI's CssBaseline or the Redux Provider. Pure file move —
route groups don't affect URLs."
```

---

### Task 2: `lib/broadcast/liveSet.ts` — the shared set-reducer

The pure vocabulary and reducer everything else in this plan is built on: no I/O, no bus, no React — testable in complete isolation.

**Files:**
- Create: `lib/broadcast/liveSet.ts`
- Test: `test/broadcast/liveSet.test.ts`

**Interfaces:**
- Produces (consumed by Task 3's bus and Task 6's hook):
```ts
export type BroadcastEvent =
  | { type: 'show'; itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide'; itemId: string }
  | { type: 'update'; itemId: string; layer: number; position: number; data: unknown }
  | { type: 'command'; itemId: string; action: string; payload?: unknown }

export interface LiveTitle { itemId: string; titleKey: string; layer: number; position: number; data: unknown }
export function applyEvent(map: Map<string, LiveTitle>, event: BroadcastEvent): Map<string, LiveTitle>
export function sortLiveSet(map: Map<string, LiveTitle>): LiveTitle[] // (layer asc, position asc)
```

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/liveSet.test.ts
import { describe, it, expect } from 'vitest'
import { applyEvent, sortLiveSet, type LiveTitle } from '@/lib/broadcast/liveSet'

const lt = (itemId: string, layer: number, position = 0): LiveTitle => ({
  itemId, titleKey: 't', layer, position, data: {},
})

describe('applyEvent', () => {
  it('show adds an entry without mutating the input map', () => {
    const m0 = new Map<string, LiveTitle>()
    const m1 = applyEvent(m0, { type: 'show', itemId: 'a', titleKey: 't', layer: 1, position: 0, data: { x: 1 } })
    expect(m0.size).toBe(0)
    expect(m1.get('a')).toMatchObject({ layer: 1, data: { x: 1 } })
  })

  it('hide removes the entry', () => {
    const m1 = applyEvent(new Map([['a', lt('a', 1)]]), { type: 'hide', itemId: 'a' })
    expect(m1.has('a')).toBe(false)
  })

  it('update merges layer/position/data onto an existing entry', () => {
    const m1 = applyEvent(
      new Map([['a', lt('a', 1)]]),
      { type: 'update', itemId: 'a', layer: 5, position: 2, data: { y: 9 } },
    )
    expect(m1.get('a')).toMatchObject({ layer: 5, position: 2, data: { y: 9 } })
  })

  it('update on an absent entry is a no-op', () => {
    const m1 = applyEvent(new Map(), { type: 'update', itemId: 'ghost', layer: 5, position: 0, data: {} })
    expect(m1.size).toBe(0)
  })

  it('command does not alter the set', () => {
    const m0 = new Map([['a', lt('a', 1)]])
    const m1 = applyEvent(m0, { type: 'command', itemId: 'a', action: 'start' })
    expect([...m1.entries()]).toEqual([...m0.entries()])
  })
})

describe('sortLiveSet', () => {
  it('orders by layer asc then position asc', () => {
    const m = new Map([['a', lt('a', 2, 0)], ['b', lt('b', 0, 1)], ['c', lt('c', 0, 0)]])
    expect(sortLiveSet(m).map((t) => t.itemId)).toEqual(['c', 'b', 'a'])
  })

  it('returns an empty array for an empty map', () => {
    expect(sortLiveSet(new Map())).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/broadcast/liveSet.test.ts`
Expected: FAIL — cannot resolve `@/lib/broadcast/liveSet`.

- [ ] **Step 3: Implement**

```ts
// lib/broadcast/liveSet.ts
// The pure event vocabulary + reducer for one broadcast channel's live set.
// No I/O, no bus, no React. lib/broadcast/bus.ts wraps this in the stateful
// in-process pub/sub; lib/broadcast/useTitleStream.ts wraps it on the client,
// replaying the identical events over SSE.

export type BroadcastEvent =
  | { type: 'show'; itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide'; itemId: string }
  | { type: 'update'; itemId: string; layer: number; position: number; data: unknown }
  | { type: 'command'; itemId: string; action: string; payload?: unknown }

export interface LiveTitle {
  itemId: string
  titleKey: string
  layer: number
  position: number
  data: unknown
}

// command events are imperative and fire-and-forget: never part of the set,
// so a late/duplicate command can never desync a reconnecting client's replay.
export function applyEvent(map: Map<string, LiveTitle>, event: BroadcastEvent): Map<string, LiveTitle> {
  if (event.type === 'command') return map

  const next = new Map(map)
  if (event.type === 'show') {
    next.set(event.itemId, {
      itemId: event.itemId,
      titleKey: event.titleKey,
      layer: event.layer,
      position: event.position,
      data: event.data,
    })
  } else if (event.type === 'hide') {
    next.delete(event.itemId)
  } else {
    const existing = next.get(event.itemId)
    if (existing) {
      next.set(event.itemId, { ...existing, layer: event.layer, position: event.position, data: event.data })
    }
  }
  return next
}

// Higher layer renders on top; position breaks ties within a layer.
export function sortLiveSet(map: Map<string, LiveTitle>): LiveTitle[] {
  return [...map.values()].sort((a, b) => a.layer - b.layer || a.position - b.position)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/broadcast/liveSet.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/liveSet.ts test/broadcast/liveSet.test.ts
git commit -m "feat(broadcast): applyEvent + sortLiveSet set-reducer"
```

---

### Task 3: `lib/broadcast/bus.ts` — channel-aware stateful pub/sub

**Files:**
- Create: `lib/broadcast/bus.ts`
- Test: `test/broadcast/bus.test.ts`

**Interfaces:**
- Consumes: `applyEvent`, `sortLiveSet`, `LiveTitle`, `BroadcastEvent` (Task 2).
- Produces (consumed by Task 4's SSE route):
```ts
export function publish(rundownId: string, channel: 'preview' | 'air', event: BroadcastEvent): void
export function subscribe(rundownId: string, channel: 'preview' | 'air', fn: (event: BroadcastEvent) => void): () => void
export function getSnapshot(rundownId: string, channel: 'preview' | 'air'): LiveTitle[]
```

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { publish, subscribe, getSnapshot } from '@/lib/broadcast/bus'

// Bus state is module-level (in-process); give every test its own rundownId
// so runs can't bleed into each other.
let n = 0
const rid = () => `r${++n}`

describe('bus', () => {
  it('delivers published events to subscribers on the same (rundownId, channel)', () => {
    const id = rid()
    const fn = vi.fn()
    subscribe(id, 'air', fn)
    const event = { type: 'show', itemId: 'a', titleKey: 't', layer: 0, position: 0, data: {} } as const
    publish(id, 'air', event)
    expect(fn).toHaveBeenCalledWith(event)
  })

  it('does not deliver to a subscriber on a different channel or rundown', () => {
    const id = rid()
    const airFn = vi.fn()
    const previewFn = vi.fn()
    const otherRundownFn = vi.fn()
    subscribe(id, 'air', airFn)
    subscribe(id, 'preview', previewFn)
    subscribe(rid(), 'air', otherRundownFn)
    publish(id, 'air', { type: 'hide', itemId: 'a' })
    expect(airFn).toHaveBeenCalledTimes(1)
    expect(previewFn).not.toHaveBeenCalled()
    expect(otherRundownFn).not.toHaveBeenCalled()
  })

  it('unsubscribe stops further delivery', () => {
    const id = rid()
    const fn = vi.fn()
    const unsub = subscribe(id, 'air', fn)
    unsub()
    publish(id, 'air', { type: 'hide', itemId: 'a' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('accumulates show/hide into the snapshot and returns it sorted', () => {
    const id = rid()
    publish(id, 'air', { type: 'show', itemId: 'a', titleKey: 't', layer: 2, position: 0, data: {} })
    publish(id, 'air', { type: 'show', itemId: 'b', titleKey: 't', layer: 0, position: 0, data: {} })
    publish(id, 'air', { type: 'hide', itemId: 'a' })
    expect(getSnapshot(id, 'air').map((t) => t.itemId)).toEqual(['b'])
  })

  it('isolates snapshots by channel and rundown', () => {
    const id = rid()
    publish(id, 'preview', { type: 'show', itemId: 'p', titleKey: 't', layer: 0, position: 0, data: {} })
    expect(getSnapshot(id, 'air')).toEqual([])
    expect(getSnapshot(id, 'preview').map((t) => t.itemId)).toEqual(['p'])
  })

  it('a command event reaches subscribers but never enters the snapshot', () => {
    const id = rid()
    const fn = vi.fn()
    subscribe(id, 'air', fn)
    publish(id, 'air', { type: 'show', itemId: 'a', titleKey: 't', layer: 0, position: 0, data: {} })
    publish(id, 'air', { type: 'command', itemId: 'a', action: 'start' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(getSnapshot(id, 'air').map((t) => t.itemId)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/broadcast/bus.test.ts`
Expected: FAIL — cannot resolve `@/lib/broadcast/bus`.

- [ ] **Step 3: Implement**

```ts
// lib/broadcast/bus.ts
// In-process pub/sub, channel-aware, with a stateful snapshot per
// (rundownId, channel). Single-instance only — see CLAUDE.md's
// "Single-server pub/sub caveat".
import { applyEvent, sortLiveSet, type BroadcastEvent, type LiveTitle } from './liveSet'

export type { BroadcastEvent } from './liveSet'

type Channel = 'preview' | 'air'
type Key = `${string}:${Channel}`

const key = (rundownId: string, channel: Channel): Key => `${rundownId}:${channel}`

const subscribers = new Map<Key, Set<(event: BroadcastEvent) => void>>()
const snapshots = new Map<Key, Map<string, LiveTitle>>()

export function publish(rundownId: string, channel: Channel, event: BroadcastEvent): void {
  const k = key(rundownId, channel)
  snapshots.set(k, applyEvent(snapshots.get(k) ?? new Map(), event))
  subscribers.get(k)?.forEach((fn) => fn(event))
}

export function subscribe(rundownId: string, channel: Channel, fn: (event: BroadcastEvent) => void): () => void {
  const k = key(rundownId, channel)
  const set = subscribers.get(k) ?? new Set()
  set.add(fn)
  subscribers.set(k, set)
  return () => set.delete(fn)
}

export function getSnapshot(rundownId: string, channel: Channel): LiveTitle[] {
  return sortLiveSet(snapshots.get(key(rundownId, channel)) ?? new Map())
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/broadcast/bus.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/bus.ts test/broadcast/bus.test.ts
git commit -m "feat(broadcast): channel-aware stateful pub/sub"
```

---

### Task 4: SSE Edge route — replay snapshot, then live events + heartbeat

**Files:**
- Create: `app/api/broadcast/[rundownId]/stream/route.ts`
- Test: `test/app/api/broadcast-stream.test.ts`

**Interfaces:**
- Consumes: `getSnapshot`, `subscribe`, `BroadcastEvent` (Task 3).
- Produces: `GET` Edge handler at `/api/broadcast/[rundownId]/stream?channel=preview|air`.

- [ ] **Step 1: Write the failing test**

```ts
// test/app/api/broadcast-stream.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSnapshotMock = vi.fn()
const subscribeMock = vi.fn(() => () => {})
vi.mock('@/lib/broadcast/bus', () => ({
  getSnapshot: (...args: unknown[]) => getSnapshotMock(...args),
  subscribe: (...args: unknown[]) => subscribeMock(...args),
}))

const { GET } = await import('@/app/api/broadcast/[rundownId]/stream/route')

function ctx(rundownId = 'r1') {
  return { params: Promise.resolve({ rundownId }) }
}

async function readChunk(res: Response) {
  const reader = res.body!.getReader()
  const { value } = await reader.read()
  await reader.cancel()
  return new TextDecoder().decode(value)
}

describe('GET /api/broadcast/[rundownId]/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSnapshotMock.mockReturnValue([])
  })

  it('sets SSE headers', async () => {
    const res = await GET(new Request('http://t/x?channel=air'), ctx())
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('replays the snapshot as show events before subscribing', async () => {
    getSnapshotMock.mockReturnValue([{ itemId: 'a', titleKey: 't', layer: 1, position: 0, data: { x: 1 } }])
    const res = await GET(new Request('http://t/x?channel=air'), ctx('r1'))
    const text = await readChunk(res)
    expect(text).toContain('"type":"show"')
    expect(text).toContain('"itemId":"a"')
    expect(getSnapshotMock).toHaveBeenCalledWith('r1', 'air')
    expect(subscribeMock).toHaveBeenCalledWith('r1', 'air', expect.any(Function))
  })

  it('defaults to the preview channel for anything other than "air"', async () => {
    await GET(new Request('http://t/x'), ctx('r1'))
    expect(getSnapshotMock).toHaveBeenCalledWith('r1', 'preview')
    await GET(new Request('http://t/x?channel=bogus'), ctx('r1'))
    expect(getSnapshotMock).toHaveBeenLastCalledWith('r1', 'preview')
  })

  it('streams a live event forwarded from subscribe', async () => {
    let deliver: ((e: unknown) => void) | undefined
    subscribeMock.mockImplementation((_rid, _ch, fn) => {
      deliver = fn
      return () => {}
    })
    const res = await GET(new Request('http://t/x?channel=air'), ctx('r1'))
    deliver!({ type: 'hide', itemId: 'a' })
    const text = await readChunk(res)
    expect(text).toContain('"type":"hide"')
  })

  it('sends a heartbeat comment every 15s', async () => {
    vi.useFakeTimers()
    try {
      const res = await GET(new Request('http://t/x?channel=air'), ctx('r1'))
      vi.advanceTimersByTime(15000)
      const text = await readChunk(res)
      expect(text).toBe(': beat\n\n')
    } finally {
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/app/api/broadcast-stream.test.ts`
Expected: FAIL — cannot resolve `@/app/api/broadcast/[rundownId]/stream/route`.

- [ ] **Step 3: Implement**

```ts
// app/api/broadcast/[rundownId]/stream/route.ts
// Public, unauthenticated (rundown IDs are unguessable UUIDs — treated as
// share links, per docs/rundowns.md). Edge runtime is mandatory: Netlify
// Functions cap at 10s and this stream is long-lived. CLAUDE.md decision 6.
import { subscribe, getSnapshot, type BroadcastEvent } from '@/lib/broadcast/bus'

export const runtime = 'edge'

type Channel = 'preview' | 'air'

function resolveChannel(url: string): Channel {
  return new URL(url).searchParams.get('channel') === 'air' ? 'air' : 'preview'
}

function frame(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export async function GET(req: Request, { params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = await params
  const channel = resolveChannel(req.url)
  const enc = new TextEncoder()
  let unsub: (() => void) | undefined
  let beat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      // Reload recovery: replay the current set as `show` events before anything live.
      for (const t of getSnapshot(rundownId, channel)) {
        controller.enqueue(enc.encode(frame({ type: 'show', ...t })))
      }
      unsub = subscribe(rundownId, channel, (event: BroadcastEvent) => {
        controller.enqueue(enc.encode(frame(event)))
      })
      // Keeps the Netlify CDN / corporate proxies from closing an idle connection.
      beat = setInterval(() => controller.enqueue(enc.encode(': beat\n\n')), 15000)
    },
    cancel() {
      if (beat) clearInterval(beat)
      unsub?.()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/app/api/broadcast-stream.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/broadcast test/app/api/broadcast-stream.test.ts
git commit -m "feat(broadcast): SSE route replays snapshot then streams live events"
```

---

### Task 5: `lib/broadcast/getBroadcastContext.ts` — rundown + package label + CSS lookup

**Files:**
- Create: `lib/broadcast/getBroadcastContext.ts`
- Test: `test/broadcast/getBroadcastContext.test.ts`

**Interfaces:**
- Consumes: `db`, `rundowns`, `projects`, `projectCss` (`@/db`, `@/db/schema` — shipped).
- Produces (consumed by Task 8's layouts): `getBroadcastContext(rundownId: string): Promise<BroadcastContext | null>` where `BroadcastContext = { rundownId: string; rundownName: string; projectId: string; packageLabel: string; css: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/getBroadcastContext.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { getBroadcastContext } = await import('@/lib/broadcast/getBroadcastContext')

function mockRows(rows: unknown[]) {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  })
}

describe('getBroadcastContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when the rundown does not exist', async () => {
    mockRows([])
    expect(await getBroadcastContext('missing')).toBeNull()
  })

  it('returns the joined context, defaulting a missing css row to an empty string', async () => {
    mockRows([{ rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: null }])
    expect(await getBroadcastContext('r1')).toEqual({
      rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: '',
    })
  })

  it('keeps a real css row value', async () => {
    mockRows([{
      rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: ':root{--x:1}',
    }])
    expect((await getBroadcastContext('r1'))?.css).toBe(':root{--x:1}')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/broadcast/getBroadcastContext.test.ts`
Expected: FAIL — cannot resolve `@/lib/broadcast/getBroadcastContext`.

- [ ] **Step 3: Implement**

```ts
// lib/broadcast/getBroadcastContext.ts
// Shared by the preview and air layouts: one query for the rundown, its
// project (for project.label — the asset/CSS folder), and any custom CSS.
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns, projects, projectCss } from '@/db/schema'

export interface BroadcastContext {
  rundownId: string
  rundownName: string
  projectId: string
  packageLabel: string // project.label — the overlay-package folder, never the project UUID
  css: string
}

export async function getBroadcastContext(rundownId: string): Promise<BroadcastContext | null> {
  const [row] = await db
    .select({
      rundownId: rundowns.id,
      rundownName: rundowns.name,
      projectId: projects.id,
      packageLabel: projects.label,
      css: projectCss.css,
    })
    .from(rundowns)
    .innerJoin(projects, eq(rundowns.projectId, projects.id))
    .leftJoin(projectCss, eq(projectCss.projectId, projects.id))
    .where(eq(rundowns.id, rundownId))

  if (!row) return null
  return { ...row, css: row.css ?? '' }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/broadcast/getBroadcastContext.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/getBroadcastContext.ts test/broadcast/getBroadcastContext.test.ts
git commit -m "feat(broadcast): rundown + package-label + CSS lookup for the broadcast layouts"
```

---

### Task 6: `lib/broadcast/useTitleStream.ts` — the client hook

**Files:**
- Create: `lib/broadcast/useTitleStream.ts`
- Test: `test/broadcast/useTitleStream.test.ts`

**Interfaces:**
- Consumes: `applyEvent`, `sortLiveSet`, `LiveTitle`, `BroadcastEvent` (Task 2).
- Produces (consumed by Task 8's pages and Task 9): `useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[]`.

- [ ] **Step 1: Write the failing test**

```ts
// test/broadcast/useTitleStream.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'

class FakeES {
  static last: FakeES | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  url: string
  constructor(url: string) { this.url = url; FakeES.last = this }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

beforeEach(() => { vi.stubGlobal('EventSource', FakeES as unknown as typeof EventSource) })

describe('useTitleStream', () => {
  it('accumulates shows into a layer-sorted set and drops on hide', () => {
    const { result } = renderHook(() => useTitleStream('r1', 'air'))
    expect(result.current).toEqual([])

    act(() => FakeES.last!.emit({ type: 'show', itemId: 'a', titleKey: 't', layer: 2, position: 0, data: {} }))
    act(() => FakeES.last!.emit({ type: 'show', itemId: 'b', titleKey: 't', layer: 0, position: 0, data: {} }))
    expect(result.current.map((t) => t.itemId)).toEqual(['b', 'a'])

    act(() => FakeES.last!.emit({ type: 'hide', itemId: 'a' }))
    expect(result.current.map((t) => t.itemId)).toEqual(['b'])
  })

  it('subscribes to the channel-specific URL', () => {
    renderHook(() => useTitleStream('r1', 'preview'))
    expect(FakeES.last!.url).toContain('channel=preview')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/broadcast/useTitleStream.test.ts`
Expected: FAIL — cannot resolve `@/lib/broadcast/useTitleStream`.

- [ ] **Step 3: Implement**

```ts
// lib/broadcast/useTitleStream.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { applyEvent, sortLiveSet, type LiveTitle, type BroadcastEvent } from './liveSet'

export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[] {
  const [titles, setTitles] = useState<LiveTitle[]>([])
  const mapRef = useRef<Map<string, LiveTitle>>(new Map())

  useEffect(() => {
    mapRef.current = new Map()
    setTitles([])
    const es = new EventSource(`/api/broadcast/${rundownId}/stream?channel=${channel}`)
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as BroadcastEvent
      mapRef.current = applyEvent(mapRef.current, event)
      setTitles(sortLiveSet(mapRef.current))
    }
    // EventSource auto-reconnects on network drop; no manual retry needed.
    return () => es.close()
  }, [rundownId, channel])

  return titles
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/broadcast/useTitleStream.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/useTitleStream.ts test/broadcast/useTitleStream.test.ts
git commit -m "feat(broadcast): useTitleStream client hook"
```

---

### Task 7: `lib/broadcast/TitleRenderer.tsx` — render the layered set

**Files:**
- Create: `lib/broadcast/TitleRenderer.tsx`
- Test: `test/broadcast/TitleRenderer.test.tsx`

**Interfaces:**
- Consumes: `getTitleEntry` (`@/lib/titles/registry`, shipped in P3); `LiveTitle` (Task 2).
- Produces (consumed by Task 8's pages and Task 9): `TitleRenderer({ titles, packageLabel }: { titles: LiveTitle[]; packageLabel: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// test/broadcast/TitleRenderer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'
import type { LiveTitle } from '@/lib/broadcast/liveSet'

const lowerThird: LiveTitle = {
  itemId: 'i1', titleKey: 'lower-third', layer: 3, position: 0,
  data: { playerName: 'Casey Liu', teamName: 'Boom Squad' },
}
const openingTimer: LiveTitle = {
  itemId: 'i2', titleKey: 'opening-timer', layer: 0, position: 0,
  data: { hours: 0, minutes: 15, seconds: 0, main_text: 'Kickoff' },
}

describe('TitleRenderer', () => {
  it('renders each title against its data, using the real default-package registry', () => {
    render(<TitleRenderer titles={[lowerThird, openingTimer]}
      packageLabel="default" />)
    expect(screen.getByText('Casey Liu')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
  })

  it('gives a full-screen title the fixed-inset class and stacks by layer via zIndex', () => {
    const { container } = render(<TitleRenderer titles={[lowerThird, openingTimer]}
      packageLabel="default" />)
    const wrappers = container.querySelectorAll(':scope > div')
    expect(wrappers[0]).toHaveStyle({ zIndex: '3' })
    expect(wrappers[0]).not.toHaveClass('fixed')
    expect(wrappers[1]).toHaveStyle({ zIndex: '0' })
    expect(wrappers[1]).toHaveClass('fixed', 'inset-0')
  })

  it('silently skips an unknown titleKey instead of crashing', () => {
    const ghost: LiveTitle = { itemId: 'i3', titleKey: 'nonexistent', layer: 0, position: 0, data: {} }
    const { container } = render(<TitleRenderer titles={[ghost]}
      packageLabel="default" />)
    expect(container.querySelectorAll(':scope > div')).toHaveLength(0)
  })

  it('renders nothing for an empty set', () => {
    const { container } = render(<TitleRenderer titles={[]}
      packageLabel="default" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/broadcast/TitleRenderer.test.tsx`
Expected: FAIL — cannot resolve `@/lib/broadcast/TitleRenderer`.

- [ ] **Step 3: Implement**

```tsx
// lib/broadcast/TitleRenderer.tsx
'use client'

import { getTitleEntry } from '@/lib/titles/registry'
import type { LiveTitle } from './liveSet'

export function TitleRenderer({
  titles, packageLabel,
}: { titles: LiveTitle[]; packageLabel: string }) {
  return (
    <>
      {titles.map((t) => {
        const entry = getTitleEntry(packageLabel, t.titleKey)
        if (!entry) return null
        const Title = entry.Component as (props: { data: unknown }) => React.ReactNode
        const { settings } = entry
        const bg = settings.title_background
          && `/projects/${packageLabel}/assets/titles/backgrounds/${settings.title_background}`
        return (
          <div key={t.itemId}
            className={settings.title_is_full_screen ? 'fixed inset-0' : undefined}
            style={{ zIndex: t.layer }}>
            {bg && (
              <video src={bg}
                autoPlay
                muted
                loop
                className="fixed inset-0 -z-10 h-full w-full object-cover" />
            )}
            <Title data={t.data} />
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/broadcast/TitleRenderer.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/broadcast/TitleRenderer.tsx test/broadcast/TitleRenderer.test.tsx
git commit -m "feat(broadcast): TitleRenderer stacks the live set by layer"
```

---

### Task 8: `/preview/[rundownId]` and `/air/[rundownId]` — the broadcast route group

**Files:**
- Create: `lib/broadcast/PackageLabelContext.tsx`
- Create: `app/(broadcast)/layout.tsx`
- Create: `app/(broadcast)/preview/[rundownId]/layout.tsx`
- Create: `app/(broadcast)/preview/[rundownId]/page.tsx`
- Create: `app/(broadcast)/air/[rundownId]/layout.tsx`
- Create: `app/(broadcast)/air/[rundownId]/page.tsx`
- Test: `test/app/broadcast-pages.test.tsx`

**Interfaces:**
- Consumes: `getBroadcastContext` (Task 5), `useTitleStream` (Task 6), `TitleRenderer` (Task 7).
- Produces: the public routes `/preview/[rundownId]`, `/air/[rundownId]`.

> Layouts are Server Components (they call `getBroadcastContext`, which touches `db` — Node runtime, not Edge, per the Global Constraints). Pages are Client Components (they call the `useTitleStream` hook, which needs `EventSource`). A layout can't pass props directly to its page in the App Router, so `PackageLabelContext` carries `packageLabel` from the server layout down to the client page.

- [ ] **Step 1: Write the failing test**

```tsx
// test/app/broadcast-pages.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const getBroadcastContextMock = vi.fn()
vi.mock('@/lib/broadcast/getBroadcastContext', () => ({
  getBroadcastContext: (...args: unknown[]) => getBroadcastContextMock(...args),
}))

const useTitleStreamMock = vi.fn(() => [])
vi.mock('@/lib/broadcast/useTitleStream', () => ({
  useTitleStream: (...args: unknown[]) => useTitleStreamMock(...args),
}))

vi.mock('@/lib/broadcast/TitleRenderer', () => ({
  TitleRenderer: ({ packageLabel }: { packageLabel: string }) => (
    <div data-testid="renderer">
      {packageLabel}
    </div>
  ),
}))

const AirLayout = (await import('@/app/(broadcast)/air/[rundownId]/layout')).default
const AirPage = (await import('@/app/(broadcast)/air/[rundownId]/page')).default
const PreviewLayout = (await import('@/app/(broadcast)/preview/[rundownId]/layout')).default
const PreviewPage = (await import('@/app/(broadcast)/preview/[rundownId]/page')).default
const { PackageLabelProvider } = await import('@/lib/broadcast/PackageLabelContext')

const CTX = { rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: '' }

describe('broadcast layouts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AirLayout shows "Rundown not found" when the rundown does not exist', async () => {
    getBroadcastContextMock.mockResolvedValue(null)
    const el = await AirLayout({ params: Promise.resolve({ rundownId: 'ghost' }), children: <div>child</div> })
    render(el)
    expect(screen.getByText('Rundown not found')).toBeInTheDocument()
    expect(screen.queryByText('child')).not.toBeInTheDocument()
  })

  it('AirLayout loads the package stylesheet and renders its children', async () => {
    getBroadcastContextMock.mockResolvedValue(CTX)
    const el = await AirLayout({ params: Promise.resolve({ rundownId: 'r1' }), children: <div>child</div> })
    const { container } = render(el)
    expect(container.querySelector('link[rel="stylesheet"]')?.getAttribute('href'))
      .toBe('/projects/default/styles/project.css')
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('PreviewLayout does the same lookup and wiring', async () => {
    getBroadcastContextMock.mockResolvedValue(CTX)
    const el = await PreviewLayout({ params: Promise.resolve({ rundownId: 'r1' }), children: <div>child</div> })
    const { container } = render(el)
    expect(container.querySelector('link[rel="stylesheet"]')?.getAttribute('href'))
      .toBe('/projects/default/styles/project.css')
  })
})

describe('broadcast pages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AirPage subscribes to the air channel and forwards params.rundownId and the provided packageLabel', () => {
    render(
      <PackageLabelProvider packageLabel="default">
        <AirPage params={Promise.resolve({ rundownId: 'r1' })} />
      </PackageLabelProvider>,
    )
    expect(useTitleStreamMock).toHaveBeenCalledWith('r1', 'air')
    expect(screen.getByTestId('renderer')).toHaveTextContent('default')
  })

  it('PreviewPage subscribes to the preview channel', () => {
    render(
      <PackageLabelProvider packageLabel="default">
        <PreviewPage params={Promise.resolve({ rundownId: 'r1' })} />
      </PackageLabelProvider>,
    )
    expect(useTitleStreamMock).toHaveBeenCalledWith('r1', 'preview')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/app/broadcast-pages.test.tsx`
Expected: FAIL — cannot resolve `@/app/(broadcast)/air/[rundownId]/layout` (none of the files exist yet).

- [ ] **Step 3: Implement `PackageLabelContext`**

```tsx
// lib/broadcast/PackageLabelContext.tsx
'use client'

import { createContext, useContext } from 'react'

const PackageLabelContext = createContext<string | null>(null)

export function PackageLabelProvider({
  packageLabel, children,
}: { packageLabel: string; children: React.ReactNode }) {
  return (
    <PackageLabelContext.Provider value={packageLabel}>
      {children}
    </PackageLabelContext.Provider>
  )
}

export function usePackageLabel(): string {
  const value = useContext(PackageLabelContext)
  if (!value) throw new Error('usePackageLabel must be used within a PackageLabelProvider')
  return value
}
```

- [ ] **Step 4: Implement the bare broadcast root layout**

```tsx
// app/(broadcast)/layout.tsx
// Root layout for /preview and /air — deliberately independent of
// app/(admin)/layout.tsx. OBS/vMix needs a genuinely transparent canvas;
// the admin root layout pulls in MUI's CssBaseline (paints a non-transparent
// theme background onto <body>) and the Redux Provider, neither of which
// belongs on a broadcast page.
export const metadata = { title: 'ETS — Broadcast' }

export default function BroadcastRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'transparent' }}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Implement the air layout + page**

```tsx
// app/(broadcast)/air/[rundownId]/layout.tsx
import { getBroadcastContext } from '@/lib/broadcast/getBroadcastContext'
import { PackageLabelProvider } from '@/lib/broadcast/PackageLabelContext'

export default async function AirLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ rundownId: string }> }) {
  const { rundownId } = await params
  const ctx = await getBroadcastContext(rundownId)
  if (!ctx) return <div>Rundown not found</div>

  return (
    <>
      {/* the folder is the package label, NOT the project UUID */}
      <link rel="stylesheet"
        href={`/projects/${ctx.packageLabel}/styles/project.css`} />
      {ctx.css && <style dangerouslySetInnerHTML={{ __html: ctx.css }} />}
      <PackageLabelProvider packageLabel={ctx.packageLabel}>
        {children}
      </PackageLabelProvider>
    </>
  )
}
```

```tsx
// app/(broadcast)/air/[rundownId]/page.tsx
'use client'

import { use } from 'react'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'
import { usePackageLabel } from '@/lib/broadcast/PackageLabelContext'

export default function AirPage({ params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = use(params)
  const packageLabel = usePackageLabel()
  const titles = useTitleStream(rundownId, 'air')
  return <TitleRenderer titles={titles}
    packageLabel={packageLabel} />
}
```

- [ ] **Step 6: Implement the preview layout + page (identical, `channel: 'preview'`)**

```tsx
// app/(broadcast)/preview/[rundownId]/layout.tsx
import { getBroadcastContext } from '@/lib/broadcast/getBroadcastContext'
import { PackageLabelProvider } from '@/lib/broadcast/PackageLabelContext'

export default async function PreviewLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ rundownId: string }> }) {
  const { rundownId } = await params
  const ctx = await getBroadcastContext(rundownId)
  if (!ctx) return <div>Rundown not found</div>

  return (
    <>
      <link rel="stylesheet"
        href={`/projects/${ctx.packageLabel}/styles/project.css`} />
      {ctx.css && <style dangerouslySetInnerHTML={{ __html: ctx.css }} />}
      <PackageLabelProvider packageLabel={ctx.packageLabel}>
        {children}
      </PackageLabelProvider>
    </>
  )
}
```

```tsx
// app/(broadcast)/preview/[rundownId]/page.tsx
'use client'

import { use } from 'react'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'
import { usePackageLabel } from '@/lib/broadcast/PackageLabelContext'

export default function PreviewPage({ params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = use(params)
  const packageLabel = usePackageLabel()
  const titles = useTitleStream(rundownId, 'preview')
  return <TitleRenderer titles={titles}
    packageLabel={packageLabel} />
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run test/app/broadcast-pages.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 8: Run the full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green; the build's route table now lists `/preview/[rundownId]` and `/air/[rundownId]`.

- [ ] **Step 9: Commit**

```bash
git add lib/broadcast/PackageLabelContext.tsx "app/(broadcast)" test/app/broadcast-pages.test.tsx
git commit -m "feat(broadcast): /preview and /air render the live set"
```

---

### Task 9: Integration test — a published `show` renders on `/air`

No new source files. Chains Tasks 3, 4, 6, and 7's **real** modules (nothing mocked except `EventSource`, which jsdom doesn't implement) into one test: `bus.publish` → the real SSE route's `GET` handler → the exact wire payload it emits → the real `useTitleStream` hook (fed via a fake `EventSource`, since Task 4 already proves the route's output over the real wire format) → the real `TitleRenderer` → a real title component from the `default` package.

**Files:**
- Test: `test/broadcast/integration.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// test/broadcast/integration.test.tsx
// Exercises the real bus -> real SSE route -> (simulated wire, since jsdom
// has no EventSource) -> real hook -> real renderer -> real title component.
// Task 4 separately proves the route's output is well-formed SSE text; this
// test proves that text, once received, ends up as pixels.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { publish } from '@/lib/broadcast/bus'
import { GET } from '@/app/api/broadcast/[rundownId]/stream/route'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'

class FakeES {
  static last: FakeES | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  constructor(public url: string) { FakeES.last = this }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

beforeEach(() => { vi.stubGlobal('EventSource', FakeES as unknown as typeof EventSource) })

async function readOneFrame(res: Response) {
  const reader = res.body!.getReader()
  const { value } = await reader.read()
  await reader.cancel()
  return new TextDecoder().decode(value)
}

function Air({ rundownId }: { rundownId: string }) {
  const titles = useTitleStream(rundownId, 'air')
  return <TitleRenderer titles={titles}
    packageLabel="default" />
}

describe('broadcast integration: publish -> renders on air', () => {
  it('a published show event ends up rendered by the real title component', async () => {
    const rundownId = `integration-${Date.now()}`
    publish(rundownId, 'air', {
      type: 'show', itemId: 'i1', titleKey: 'lower-third', layer: 0, position: 0,
      data: { playerName: 'Casey Liu', teamName: 'Boom Squad' },
    })

    // Real SSE route, reading the real bus snapshot for this rundown.
    const res = await GET(new Request('http://t/x?channel=air'), { params: Promise.resolve({ rundownId }) })
    const text = await readOneFrame(res)
    const event = JSON.parse(text.replace(/^data: /, '').trim())
    expect(event).toMatchObject({ type: 'show', itemId: 'i1', titleKey: 'lower-third' })

    // Feed that exact wire payload into the real hook via a fake transport.
    render(<Air rundownId={rundownId} />)
    act(() => FakeES.last!.emit(event))

    expect(await screen.findByText('Casey Liu')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run test/broadcast/integration.test.tsx`
Expected: PASS. If it fails, the bug is in the wiring between two already-tested units (Tasks 3–7), not in a unit itself — re-check the event shape crossing each boundary.

- [ ] **Step 3: Run the full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add test/broadcast/integration.test.tsx
git commit -m "test(broadcast): integration check that publish() renders on /air"
```

---

### Task 10: Sync docs to what P4 shipped

**Files:**
- Modify: `docs/preview-air.md`, `docs/superpowers/specs/2026-06-18-base-app-scope.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything Tasks 1–9 produced.
- Produces: docs P5a/P5b can trust.

- [ ] **Step 1: Rewrite `docs/preview-air.md` to the shipped design**

It currently describes the pre-multi-layer single-title contract (`CurrentTitle`, a `BroadcastEvent` with no `layer`/`position`, `getTitle` from a `./registry` that was never built). Replace:
- The event shape with the shipped `BroadcastEvent` (Task 2) — `show`/`hide`/`update`/`command`, `layer`+`position` on `show`/`update`.
- `useTitleStream`'s return type: `LiveTitle[]`, not `CurrentTitle`.
- `TitleRenderer`'s props: `{ titles, packageLabel }`, mapping through `getTitleEntry(packageLabel, titleKey)` from `@/lib/titles/registry` — not a `./registry` module that was never built.
- The page/layout sketch: `app/(broadcast)/{preview,air}/[rundownId]/{page,layout}.tsx`, the layout using `getBroadcastContext` (Task 5), not a raw `db.query.rundowns.findFirst({ with: { project: true } })` (this schema has no `relations()` definitions, so that relational-query sketch never worked — every existing route uses `db.select().from(...).innerJoin(...)`, and so does `getBroadcastContext`).
- Note the `(broadcast)` route group exists specifically so these pages don't inherit `app/(admin)/layout.tsx`'s MUI `CssBaseline`/Redux `Provider`.
- Keep the SSE endpoint contract, heartbeat, and OBS/vMix setup sections — those didn't change.

- [ ] **Step 2: Update the scope doc**

`docs/superpowers/specs/2026-06-18-base-app-scope.md`:
- Flip **P4** to ✅ done with a one-line summary of what shipped (bus, SSE replay, `(broadcast)` route group, `/preview`+`/air`); mark **P5a** as next.
- Update the "Build order" line similarly to how P3's Task 9 updated it for P3.

- [ ] **Step 3: Update `CLAUDE.md`**

- Route map: add `/preview/[rundownId]`, `/air/[rundownId]` (public, no Redux) and `GET /api/broadcast/[rundownId]/stream` (public SSE, Edge) if not already accurately listed.
- Note in decision 5 (SSE bus) that `layer`/`position` live in the event payload, not in `rundown_items` (that column is still pending, P5b).
- Note that `/admin`, `/login`, `/dev/title-preview` now live under the `app/(admin)/` route group (URLs unchanged) and `/preview`, `/air` under `app/(broadcast)/` — each with its own root layout.

- [ ] **Step 4: Sweep for contradictions**

Run: `grep -rn "CurrentTitle\|db.query.rundowns.findFirst\|from './registry'" docs CLAUDE.md --exclude-dir=superpowers`
Expected: no matches.

- [ ] **Step 5: Final verification**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs(broadcast): sync preview-air docs to the shipped P4 contract"
```

---

## Self-review notes

- **Spec coverage.** `lib/broadcast/liveSet.ts` (`applyEvent`/`sortLiveSet`/`BroadcastEvent`) → T2. `lib/broadcast/bus.ts` (channel-aware pub/sub + stateful snapshot) → T3. SSE Edge route replaying the snapshot before live events → T4. `/preview`+`/air` rendering the set via `useTitleStream` → `TitleRenderer`, ordered by `(layer, position)` with `z-index: layer`, no Redux → T6–T8. All exactly matches the P4 bullets in `docs/superpowers/specs/2026-06-18-base-app-scope.md`.
- **Deliberately deferred, and to where.** `rundown_items.layer` (the DB column), `computeTake`, `/take`, the preview-toggle and hide-air routes, the controller UI, and delivering `command` events to a mounted title's `onCommand` — all P5b, via the existing `docs/superpowers/plans/2026-06-21-multi-layer-preview-air.md` (its Tasks 1, 2, 7–10, 10b, 12–13). This plan's `BroadcastEvent`/`LiveTitle`/`applyEvent`/`sortLiveSet`/`getSnapshot` are exactly the signatures that plan's Tasks 3–6 already specify, so P5b consumes them unchanged rather than rebuilding them.
- **Type consistency.** `BroadcastEvent` is defined once (T2) and imported — never redefined — by `bus.ts` (T3), the SSE route (T4), `useTitleStream` (T6), and the integration test (T9). `LiveTitle` likewise flows from T2 through T3, T6, T7, T8 unchanged. `packageLabel` is threaded from `getBroadcastContext` (T5) through `PackageLabelContext` (T8) to `TitleRenderer` (T7) with the same name and type throughout.
- **Why Task 1 exists.** It's not in the scope doc's P4 bullet list because that list was written before anyone noticed `app/layout.tsx` unconditionally wraps every route in MUI's `CssBaseline`, which paints a solid background on `<body>` — fatal for a page OBS is supposed to key as transparent. Confirmed against the shipped `app/providers.tsx`, not assumed.
