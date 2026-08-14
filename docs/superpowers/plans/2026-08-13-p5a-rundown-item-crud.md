# P5a — Rundown-item CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator add / edit / reorder / delete title items in a rundown, where each item's `data` is a form generated from that title's `model.ts` and validated against the same Zod schema at the API boundary.

**Architecture:** The server serializes each title's Zod `model.ts` into plain-JSON **field descriptors** (`describeModel`); the admin renders inputs from descriptors and never holds the Zod schema. The item routes validate `data` against the real `getTitleModel(label, key)` — server is authoritative. No new DB migration (schema already has `rundown_items`).

**Tech Stack:** Next.js 16 App Router (route handlers), React 19, TypeScript, Zod 3.25.76, Drizzle ORM, RTK Query, React Hook Form + `zodResolver`, MUI, Vitest + RTL.

**Design spec:** `docs/superpowers/specs/2026-08-13-p5a-rundown-item-crud-design.md` (read for rationale; this plan is the build order).

## Global Constraints

Every task's requirements implicitly include these:

- **No migration.** P5a adds no column and no `db:generate`. `rundown_items`
  already has `{ id, rundownId, projectId, titleKey, label, position, data }`.
  **No `layer`, no per-item `color`** — both deferred to P5b.
- **URL is the authority.** `projectId` and `rundownId` come from route params,
  never the request body. Every item query filters by both.
- **`data` validated server-side against the real `model.ts`** via
  `getTitleModel(packageLabel, titleKey)`. Unknown `titleKey` → 400. Invalid
  `data` → 400 with `error.flatten()`. The client renders from descriptors and
  never re-parses a forked schema copy (CLAUDE.md decisions 3 & 5).
- **Zod 3.25.76 internals** (verified): object shape via `model.shape`; field
  wrapper via `field._def.typeName` (`ZodOptional` / `ZodDefault` / `ZodNullable`)
  unwrapped through `._def.innerType`; string/number bounds in `inner._def.checks`
  (`{kind:'min'|'max'|'int', value?}`); enum values in `inner._def.values`; array
  element type in `inner._def.type._def.typeName`.
- **Test patterns:** route tests use `// @vitest-environment node` and mock
  `@/lib/auth`, `@/db`, and partial-mock `drizzle-orm` (see
  `test/app/api/rundowns.test.ts`); pure-function and describeModel tests use node
  env; component tests use default jsdom + RTL (see
  `test/components/admin/crud/ExtraMapField.test.tsx`).
- **MUI** for all admin UI. Keep lines within the repo's ESLint `max-len`
  (wrap long route `export`s and JSX as the existing files do).
- **Commit after every task.** Run `npm test` green before each commit.

---

## File Structure

**Create:**
- `lib/titles/describeModel.ts` — Zod→`FieldDescriptor[]` + `computeDefaults`.
- `lib/titles/listTitleOptions.ts` — `listTitleOptions(label): TitleOption[]`.
- `db/schemas/rundown-items.ts` — create/update/reorder Zod schemas + input types.
- `lib/entities/rundown-items.ts` — `RundownItem` row type.
- `lib/rundown-items/context.ts` — `loadItemsContext` (session + ownership guard + label).
- `lib/projects/getProjectLabel.ts` — `getProjectLabel(projectId)`.
- `app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts` — GET, POST.
- `app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/route.ts` — PATCH, DELETE.
- `app/api/projects/[projectId]/rundowns/[rundownId]/items/order/route.ts` — PUT.
- `app/api/projects/[projectId]/titles/route.ts` — GET.
- `store/apis/rundownItemsApi.ts`, `store/apis/titlesApi.ts`.
- `components/admin/rundown/TitleDataForm.tsx`.
- `components/admin/rundown/AddTemplateModal.tsx`.
- `components/admin/rundown/RundownItemRow.tsx`.
- Tests mirroring each of the above under `test/`.

**Modify:**
- `store/index.ts` — register the two new slices.
- `test/store/store.test.ts` — assert the two new reducers.
- `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx` — replace the
  stub body with the item list + Add Template.
- `CLAUDE.md`, `docs/superpowers/specs/2026-06-18-base-app-scope.md`,
  `docs/rundowns.md` — mark P5a done, record deferrals.

---

### Task 1: `describeModel` + `computeDefaults`

**Files:**
- Create: `lib/titles/describeModel.ts`
- Test: `test/titles/describeModel.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type FieldDescriptor =
    | { name: string; label: string; kind: 'string'; required: boolean; minLength?: number; maxLength?: number; multiline: boolean }
    | { name: string; label: string; kind: 'number'; required: boolean; int: boolean; min?: number; max?: number }
    | { name: string; label: string; kind: 'enum'; required: boolean; options: string[] }
    | { name: string; label: string; kind: 'boolean'; required: boolean }
    | { name: string; label: string; kind: 'stringArray'; required: boolean }
  export function describeModel(model: z.ZodTypeAny): FieldDescriptor[]
  export function computeDefaults(model: z.ZodTypeAny): Record<string, unknown>
  ```
  Consumed by Tasks 6, 8, 9.

- [ ] **Step 1: Write the failing test**

```ts
// test/titles/describeModel.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { describeModel, computeDefaults } from '@/lib/titles/describeModel'
import { LowerThirdFields } from '@/models/LowerThird'

const model = z.object({
  playerName: z.string().min(1).max(40),
  teamName: z.string().max(40).optional(),
  position: z.enum(['guard', 'forward', 'center']).optional(),
  hours: z.number().int().min(0).max(99),
  bio: z.string().max(400),
  sponsors: z.array(z.string()).default([]),
  flag: z.boolean().optional(),
})

describe('describeModel', () => {
  const byName = Object.fromEntries(describeModel(model).map((f) => [f.name, f]))

  it('maps a bounded required string', () => {
    expect(byName.playerName).toMatchObject({ kind: 'string', required: true, minLength: 1, maxLength: 40, label: 'Player Name', multiline: false })
  })
  it('marks optional() fields not required', () => {
    expect(byName.teamName.required).toBe(false)
  })
  it('maps enum to options', () => {
    expect(byName.position).toMatchObject({ kind: 'enum', options: ['guard', 'forward', 'center'] })
  })
  it('maps int number with bounds', () => {
    expect(byName.hours).toMatchObject({ kind: 'number', int: true, min: 0, max: 99 })
  })
  it('sets multiline for long strings (maxLength > 60 or unset)', () => {
    expect(byName.bio.multiline).toBe(true)
  })
  it('maps array<string> and default() as not required', () => {
    expect(byName.sponsors).toMatchObject({ kind: 'stringArray', required: false })
  })
  it('maps boolean', () => {
    expect(byName.flag).toMatchObject({ kind: 'boolean', required: false })
  })
})

describe('computeDefaults', () => {
  it('gives every described field a controlled default', () => {
    const d = computeDefaults(LowerThirdFields)
    expect(d.playerName).toBe('')       // required string
    expect(d.position).toBe('guard')    // enum → first option
    expect(d.teamName).toBe('')         // optional string still controlled
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/titles/describeModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `describeModel.ts`**

```ts
import { z } from 'zod'

export type FieldDescriptor =
  | { name: string; label: string; kind: 'string'; required: boolean; minLength?: number; maxLength?: number; multiline: boolean }
  | { name: string; label: string; kind: 'number'; required: boolean; int: boolean; min?: number; max?: number }
  | { name: string; label: string; kind: 'enum'; required: boolean; options: string[] }
  | { name: string; label: string; kind: 'boolean'; required: boolean }
  | { name: string; label: string; kind: 'stringArray'; required: boolean }

const WRAPPERS = new Set(['ZodOptional', 'ZodDefault', 'ZodNullable'])

function humanize(name: string): string {
  const s = name.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function unwrap(field: z.ZodTypeAny): z.ZodTypeAny {
  let inner = field
  while (inner?._def && WRAPPERS.has(inner._def.typeName)) inner = inner._def.innerType
  return inner
}

function checkValue(inner: any, kind: string): number | undefined {
  const c = (inner._def.checks ?? []).find((x: any) => x.kind === kind)
  return c ? c.value : undefined
}

export function describeModel(model: z.ZodTypeAny): FieldDescriptor[] {
  const shape = (model as any).shape as Record<string, z.ZodTypeAny> | undefined
  if (!shape) return []
  const out: FieldDescriptor[] = []
  for (const [name, field] of Object.entries(shape)) {
    const required = !WRAPPERS.has((field as any)._def.typeName)
    const inner = unwrap(field) as any
    const label = humanize(name)
    const tn = inner._def.typeName
    if (tn === 'ZodString') {
      const maxLength = checkValue(inner, 'max')
      out.push({ name, label, kind: 'string', required, minLength: checkValue(inner, 'min'), maxLength, multiline: maxLength === undefined || maxLength > 60 })
    } else if (tn === 'ZodNumber') {
      out.push({ name, label, kind: 'number', required, int: (inner._def.checks ?? []).some((c: any) => c.kind === 'int'), min: checkValue(inner, 'min'), max: checkValue(inner, 'max') })
    } else if (tn === 'ZodEnum') {
      out.push({ name, label, kind: 'enum', required, options: [...inner._def.values] })
    } else if (tn === 'ZodBoolean') {
      out.push({ name, label, kind: 'boolean', required })
    } else if (tn === 'ZodArray' && inner._def.type?._def?.typeName === 'ZodString') {
      out.push({ name, label, kind: 'stringArray', required })
    }
    // Unsupported kinds are skipped — out of P5a scope.
  }
  return out
}

function fallback(f: FieldDescriptor): unknown {
  switch (f.kind) {
    case 'string': return ''
    case 'number': return f.min ?? 0
    case 'enum': return f.options[0] ?? ''
    case 'boolean': return false
    case 'stringArray': return []
  }
}

export function computeDefaults(model: z.ZodTypeAny): Record<string, unknown> {
  const parsed = model.safeParse({})
  const base: Record<string, unknown> = parsed.success ? { ...(parsed.data as object) } : {}
  for (const f of describeModel(model)) {
    if (base[f.name] === undefined) base[f.name] = fallback(f)
  }
  return base
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/titles/describeModel.test.ts`
Expected: PASS. If any `_def` access mismatches the installed Zod, adjust to the real shape (the test is the oracle) — do not assume.

- [ ] **Step 5: Commit**

```bash
git add lib/titles/describeModel.ts test/titles/describeModel.test.ts
git commit -m "feat(titles): describeModel + computeDefaults (Zod -> field descriptors)"
```

---

### Task 2: Rundown-item schemas + row type

**Files:**
- Create: `db/schemas/rundown-items.ts`, `lib/entities/rundown-items.ts`
- Test: `test/db/schemas/rundown-items.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // db/schemas/rundown-items.ts
  export const createRundownItemSchema: z.ZodType // { titleKey, label?, data }
  export const updateRundownItemSchema: z.ZodType // { label?, data? }
  export const reorderRundownItemsSchema: z.ZodType // { orderedIds: string[] }
  export type CreateRundownItemInput; UpdateRundownItemInput; ReorderRundownItemsInput
  // lib/entities/rundown-items.ts
  export type RundownItem = { id, rundownId, projectId, titleKey, label: string|null, position: number, data: Record<string, unknown> }
  ```
  Consumed by Tasks 3–5 (routes), 7 (slice), 9 (UI).

- [ ] **Step 1: Write the failing test**

```ts
// test/db/schemas/rundown-items.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createRundownItemSchema, updateRundownItemSchema, reorderRundownItemsSchema } from '@/db/schemas/rundown-items'

describe('rundown-item schemas', () => {
  it('create requires titleKey and defaults data to {}', () => {
    const r = createRundownItemSchema.safeParse({ titleKey: 'lower-third' })
    expect(r.success).toBe(true)
    expect(r.success && r.data.data).toEqual({})
  })
  it('create rejects empty titleKey', () => {
    expect(createRundownItemSchema.safeParse({ titleKey: '' }).success).toBe(false)
  })
  it('update allows label and data independently', () => {
    expect(updateRundownItemSchema.safeParse({ label: 'x' }).success).toBe(true)
    expect(updateRundownItemSchema.safeParse({ data: { a: 1 } }).success).toBe(true)
  })
  it('reorder requires a non-empty uuid array', () => {
    expect(reorderRundownItemsSchema.safeParse({ orderedIds: [] }).success).toBe(false)
    expect(reorderRundownItemsSchema.safeParse({ orderedIds: ['11111111-1111-1111-1111-111111111111'] }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db/schemas/rundown-items.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the schemas and row type**

```ts
// db/schemas/rundown-items.ts
import { z } from 'zod'

export const createRundownItemSchema = z.object({
  titleKey: z.string().min(1),
  label: z.string().max(120).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
})
export const updateRundownItemSchema = z.object({
  label: z.string().max(120).nullish(),
  data: z.record(z.string(), z.unknown()).optional(),
})
export const reorderRundownItemsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})
export type CreateRundownItemInput = z.infer<typeof createRundownItemSchema>
export type UpdateRundownItemInput = z.infer<typeof updateRundownItemSchema>
export type ReorderRundownItemsInput = z.infer<typeof reorderRundownItemsSchema>
```

```ts
// lib/entities/rundown-items.ts
export type RundownItem = {
  id: string
  rundownId: string
  projectId: string
  titleKey: string
  label: string | null
  position: number
  data: Record<string, unknown>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db/schemas/rundown-items.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add db/schemas/rundown-items.ts lib/entities/rundown-items.ts test/db/schemas/rundown-items.test.ts
git commit -m "feat(rundown-items): create/update/reorder schemas + RundownItem type"
```

---

### Task 3: Items context guard + GET/POST route

**Files:**
- Create: `lib/rundown-items/context.ts`, `app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts`
- Test: `test/app/api/rundown-items.test.ts`

**Interfaces:**
- Consumes: `createRundownItemSchema` (Task 2); `getTitleModel` from `@/lib/titles/registry`.
- Produces:
  ```ts
  // lib/rundown-items/context.ts
  // Returns a Response (401/404) on failure, else the resolved package label.
  export async function loadItemsContext(req: Request, projectId: string, rundownId: string): Promise<Response | { packageLabel: string }>
  ```
  `GET`/`POST` from the route (Next handler signature `(req, { params })`).

**Behavior:** POST parses body → `loadItemsContext` → `getTitleModel(packageLabel, titleKey)` (missing → 400 `{error:'unknown titleKey'}`) → `model.safeParse(data)` (fail → 400 `error.flatten()`) → `position = max(position)+1` (0 when empty) → insert `{ rundownId, projectId, titleKey, label, position, data }` → 201. GET returns the rundown's items ordered by `position`.

- [ ] **Step 1: Write the failing test** (mirror `test/app/api/rundowns.test.ts`'s mock setup — mock `@/lib/auth`, `@/db`, partial-mock `drizzle-orm`, and mock `@/lib/titles/registry`)

```ts
// test/app/api/rundown-items.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(actual.eq), and: vi.fn(actual.and), desc: vi.fn(actual.desc) }
})

const getTitleModelMock = vi.fn()
vi.mock('@/lib/titles/registry', () => ({ getTitleModel: (...a: unknown[]) => getTitleModelMock(...a) }))

// loadItemsContext resolves the label via a single joined query; stub it directly
// so these tests focus on the handler logic.
const loadCtxMock = vi.fn()
vi.mock('@/lib/rundown-items/context', () => ({ loadItemsContext: (...a: unknown[]) => loadCtxMock(...a) }))

const { POST, GET } = await import('@/app/api/projects/[projectId]/rundowns/[rundownId]/items/route')

const P = '11111111-1111-1111-1111-111111111111'
const R = '22222222-2222-2222-2222-222222222222'
function req(body?: unknown, method = 'POST') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}
function ctx() { return { params: Promise.resolve({ projectId: P, rundownId: R }) } }

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
  loadCtxMock.mockResolvedValue({ packageLabel: 'default' })
})

describe('POST items', () => {
  it('401 when loadItemsContext returns a Response', async () => {
    loadCtxMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    const res = await POST(req({ titleKey: 'lower-third' }), ctx())
    expect(res.status).toBe(401)
  })

  it('400 on unknown titleKey', async () => {
    getTitleModelMock.mockReturnValue(undefined)
    const res = await POST(req({ titleKey: 'nope' }), ctx())
    expect(res.status).toBe(400)
  })

  it('400 when data fails the title model', async () => {
    getTitleModelMock.mockReturnValue(z.object({ playerName: z.string().min(1) }))
    const res = await POST(req({ titleKey: 'lower-third', data: { playerName: '' } }), ctx())
    expect(res.status).toBe(400)
  })

  it('201, position auto-appended, projectId+rundownId from URL', async () => {
    getTitleModelMock.mockReturnValue(z.object({ playerName: z.string().min(1) }))
    // max(position) query → returns [{ position: 4 }]
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ position: 4 }]) }) }) }) })
    const row = { id: 'i1', rundownId: R, projectId: P, titleKey: 'lower-third', position: 5 }
    const returning = vi.fn().mockResolvedValue([row])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await POST(req({ titleKey: 'lower-third', data: { playerName: 'Jo' }, projectId: 'evil' }), ctx())
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ projectId: P, rundownId: R, position: 5, titleKey: 'lower-third' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/app/api/rundown-items.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Implement `context.ts`**

```ts
// lib/rundown-items/context.ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { auth } from '@/lib/auth'
import { rundowns, projects } from '@/db/schema'

export async function loadItemsContext(
  req: Request, projectId: string, rundownId: string,
): Promise<Response | { packageLabel: string }> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const [row] = await db
    .select({ packageLabel: projects.label })
    .from(rundowns)
    .innerJoin(projects, eq(rundowns.projectId, projects.id))
    .where(and(eq(rundowns.id, rundownId), eq(rundowns.projectId, projectId)))
  if (!row) return new Response('Not found', { status: 404 })
  return { packageLabel: row.packageLabel }
}
```

- [ ] **Step 4: Implement the route** (`items/route.ts`)

```ts
import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { rundownItems } from '@/db/schema'
import { createRundownItemSchema } from '@/db/schemas/rundown-items'
import { getTitleModel } from '@/lib/titles/registry'
import { loadItemsContext } from '@/lib/rundown-items/context'

type Ctx = { params: Promise<{ projectId: string; rundownId: string }> }

export async function GET(req: Request, { params }: Ctx) {
  const { projectId, rundownId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx
  const rows = await db.select().from(rundownItems)
    .where(and(eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .orderBy(rundownItems.position)
  return Response.json(rows)
}

export async function POST(req: Request, { params }: Ctx) {
  const { projectId, rundownId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx

  const parsed = createRundownItemSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const model = getTitleModel(ctx.packageLabel, parsed.data.titleKey)
  if (!model) return Response.json({ error: 'unknown titleKey' }, { status: 400 })

  const dataParsed = model.safeParse(parsed.data.data)
  if (!dataParsed.success) return Response.json(dataParsed.error.flatten(), { status: 400 })

  const [last] = await db.select({ position: rundownItems.position }).from(rundownItems)
    .where(eq(rundownItems.rundownId, rundownId))
    .orderBy(desc(rundownItems.position)).limit(1)
  const position = last ? last.position + 1 : 0

  const [row] = await db.insert(rundownItems).values({
    rundownId, projectId, titleKey: parsed.data.titleKey,
    label: parsed.data.label ?? null, position, data: dataParsed.data as Record<string, unknown>,
  }).returning()
  return Response.json(row, { status: 201 })
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/app/api/rundown-items.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/rundown-items/context.ts "app/api/projects/[projectId]/rundowns/[rundownId]/items/route.ts" test/app/api/rundown-items.test.ts
git commit -m "feat(rundown-items): GET/POST items route with dynamic model validation"
```

---

### Task 4: Item PATCH/DELETE route

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/route.ts`
- Test: `test/app/api/rundown-items-id.test.ts`

**Interfaces:**
- Consumes: `updateRundownItemSchema` (Task 2), `loadItemsContext` (Task 3), `getTitleModel`.
- Produces: `PATCH`, `DELETE`.

**Behavior:** PATCH → `loadItemsContext` → load item by `(id, rundownId, projectId)` (404 if absent) → if `data` present, re-validate against the item's own `titleKey` model (400 on fail) → update `label`/`data` → return row. DELETE → same guard → delete → 204.

- [ ] **Step 1: Write the failing test** (mock the same modules as Task 3; assert)
  - PATCH with unmatched `(id, projectId)` → 404 (db returns no row).
  - PATCH with `data` failing the model → 400.
  - PATCH label-only → 200 and `set` called with `{ label }`.
  - DELETE returns 204 when a row is deleted; 404 when none.

```ts
// test/app/api/rundown-items-id.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const dbMock = { select: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
vi.mock('drizzle-orm', async (o) => { const a = await o<typeof import('drizzle-orm')>(); return { ...a, eq: vi.fn(a.eq), and: vi.fn(a.and) } })
const getTitleModelMock = vi.fn()
vi.mock('@/lib/titles/registry', () => ({ getTitleModel: (...a: unknown[]) => getTitleModelMock(...a) }))
const loadCtxMock = vi.fn()
vi.mock('@/lib/rundown-items/context', () => ({ loadItemsContext: (...a: unknown[]) => loadCtxMock(...a) }))

const { PATCH, DELETE } = await import('@/app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/route')
const P = '11111111-1111-1111-1111-111111111111', R = '22222222-2222-2222-2222-222222222222', I = '33333333-3333-3333-3333-333333333333'
function req(body?: unknown, method = 'PATCH') { return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined }) }
function ctx() { return { params: Promise.resolve({ projectId: P, rundownId: R, itemId: I }) } }
function selectReturns(rows: unknown[]) {
  dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }) }) })
}
beforeEach(() => { vi.clearAllMocks(); loadCtxMock.mockResolvedValue({ packageLabel: 'default' }) })

it('PATCH 404 when the item is not in this rundown/project', async () => {
  selectReturns([])
  expect((await PATCH(req({ label: 'x' }), ctx())).status).toBe(404)
})
it('PATCH 400 when data fails the model', async () => {
  selectReturns([{ id: I, rundownId: R, projectId: P, titleKey: 'lower-third' }])
  getTitleModelMock.mockReturnValue(z.object({ playerName: z.string().min(1) }))
  expect((await PATCH(req({ data: { playerName: '' } }), ctx())).status).toBe(400)
})
it('PATCH updates label only', async () => {
  selectReturns([{ id: I, rundownId: R, projectId: P, titleKey: 'lower-third' }])
  const returning = vi.fn().mockResolvedValue([{ id: I, label: 'New' }])
  const where = vi.fn().mockReturnValue({ returning }); const set = vi.fn().mockReturnValue({ where })
  dbMock.update.mockReturnValue({ set })
  const res = await PATCH(req({ label: 'New' }), ctx())
  expect(res.status).toBe(200)
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ label: 'New' }))
})
it('DELETE 204 on success', async () => {
  selectReturns([{ id: I, rundownId: R, projectId: P }])
  const returning = vi.fn().mockResolvedValue([{ id: I }]); const where = vi.fn().mockReturnValue({ returning })
  dbMock.delete.mockReturnValue({ where })
  expect((await DELETE(req(undefined, 'DELETE'), ctx())).status).toBe(204)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/app/api/rundown-items-id.test.ts` → FAIL.

- [ ] **Step 3: Implement the route**

```ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownItems } from '@/db/schema'
import { updateRundownItemSchema } from '@/db/schemas/rundown-items'
import { getTitleModel } from '@/lib/titles/registry'
import { loadItemsContext } from '@/lib/rundown-items/context'

type Ctx = { params: Promise<{ projectId: string; rundownId: string; itemId: string }> }

async function loadItem(projectId: string, rundownId: string, itemId: string) {
  const [row] = await db.select().from(rundownItems)
    .where(and(eq(rundownItems.id, itemId), eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .limit(1)
  return row
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { projectId, rundownId, itemId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx

  const parsed = updateRundownItemSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const item = await loadItem(projectId, rundownId, itemId)
  if (!item) return new Response('Not found', { status: 404 })

  const patch: Record<string, unknown> = {}
  if (parsed.data.label !== undefined) patch.label = parsed.data.label
  if (parsed.data.data !== undefined) {
    const model = getTitleModel(ctx.packageLabel, item.titleKey)
    if (!model) return Response.json({ error: 'unknown titleKey' }, { status: 400 })
    const dataParsed = model.safeParse(parsed.data.data)
    if (!dataParsed.success) return Response.json(dataParsed.error.flatten(), { status: 400 })
    patch.data = dataParsed.data
  }

  const [row] = await db.update(rundownItems).set(patch)
    .where(and(eq(rundownItems.id, itemId), eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .returning()
  return Response.json(row)
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { projectId, rundownId, itemId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx
  const [row] = await db.delete(rundownItems)
    .where(and(eq(rundownItems.id, itemId), eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 4: Run tests → PASS**, then **Step 5: Commit**

```bash
git add "app/api/projects/[projectId]/rundowns/[rundownId]/items/[itemId]/route.ts" test/app/api/rundown-items-id.test.ts
git commit -m "feat(rundown-items): PATCH/DELETE item route with re-validation + ownership guard"
```

---

### Task 5: Reorder route

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[rundownId]/items/order/route.ts`
- Test: `test/app/api/rundown-items-order.test.ts`

**Interfaces:**
- Consumes: `reorderRundownItemsSchema` (Task 2), `loadItemsContext` (Task 3).
- Produces: `PUT`.

**Behavior:** parse `{ orderedIds }` → `loadItemsContext` → fetch the rundown's current item ids → reject unless `orderedIds` is a permutation of exactly those ids (same length, same set) → 400 otherwise → update each item's `position` to its array index → return the reordered rows ordered by position.

- [ ] **Step 1: Write the failing test**
  - 400 when `orderedIds` set ≠ the rundown's items (foreign or partial).
  - 200 and `update` called once per id with the index position when the set matches.

```ts
// test/app/api/rundown-items-order.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
const dbMock = { select: vi.fn(), update: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
vi.mock('drizzle-orm', async (o) => { const a = await o<typeof import('drizzle-orm')>(); return { ...a, eq: vi.fn(a.eq), and: vi.fn(a.and) } })
const loadCtxMock = vi.fn()
vi.mock('@/lib/rundown-items/context', () => ({ loadItemsContext: (...a: unknown[]) => loadCtxMock(...a) }))
const { PUT } = await import('@/app/api/projects/[projectId]/rundowns/[rundownId]/items/order/route')
const P = '11111111-1111-1111-1111-111111111111', R = '22222222-2222-2222-2222-222222222222'
const A = '33333333-3333-3333-3333-333333333333', B = '44444444-4444-4444-4444-444444444444'
function req(body: unknown) { return new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify(body) }) }
function ctx() { return { params: Promise.resolve({ projectId: P, rundownId: R }) } }
function currentIds(ids: string[]) {
  dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))) }) }) })
}
beforeEach(() => { vi.clearAllMocks(); loadCtxMock.mockResolvedValue({ packageLabel: 'default' }) })

it('400 when orderedIds is not the exact set', async () => {
  currentIds([A, B])
  expect((await PUT(req({ orderedIds: [A] }), ctx())).status).toBe(400)
})
it('200 and writes index positions', async () => {
  currentIds([A, B])
  const where = vi.fn().mockResolvedValue(undefined); const set = vi.fn().mockReturnValue({ where })
  dbMock.update.mockReturnValue({ set })
  // final read-back
  dbMock.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: A }, { id: B }]) }) }) })
    .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: B, position: 0 }, { id: A, position: 1 }]) }) }) })
  const res = await PUT(req({ orderedIds: [B, A] }), ctx())
  expect(res.status).toBe(200)
  expect(set).toHaveBeenCalledWith({ position: 0 })
  expect(set).toHaveBeenCalledWith({ position: 1 })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement the route**

```ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownItems } from '@/db/schema'
import { reorderRundownItemsSchema } from '@/db/schemas/rundown-items'
import { loadItemsContext } from '@/lib/rundown-items/context'

type Ctx = { params: Promise<{ projectId: string; rundownId: string }> }

export async function PUT(req: Request, { params }: Ctx) {
  const { projectId, rundownId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx

  const parsed = reorderRundownItemsSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { orderedIds } = parsed.data

  const current = await db.select({ id: rundownItems.id }).from(rundownItems)
    .where(and(eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .orderBy(rundownItems.position)
  const currentSet = new Set(current.map((r) => r.id))
  const sameSet = orderedIds.length === currentSet.size && orderedIds.every((id) => currentSet.has(id))
  if (!sameSet) return Response.json({ error: 'orderedIds must be the rundown\'s exact item set' }, { status: 400 })

  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(rundownItems).set({ position: i })
      .where(and(eq(rundownItems.id, orderedIds[i]), eq(rundownItems.rundownId, rundownId)))
  }
  const rows = await db.select().from(rundownItems)
    .where(and(eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .orderBy(rundownItems.position)
  return Response.json(rows)
}
```

- [ ] **Step 4: Run tests → PASS**, then **Step 5: Commit**

```bash
git add "app/api/projects/[projectId]/rundowns/[rundownId]/items/order/route.ts" test/app/api/rundown-items-order.test.ts
git commit -m "feat(rundown-items): PUT reorder route (permutation-guarded position rewrite)"
```

---

### Task 6: Titles endpoint + `listTitleOptions`

**Files:**
- Create: `lib/projects/getProjectLabel.ts`, `lib/titles/listTitleOptions.ts`, `app/api/projects/[projectId]/titles/route.ts`
- Test: `test/titles/listTitleOptions.test.ts`, `test/app/api/project-titles.test.ts`

**Interfaces:**
- Consumes: `listTitles` from `@/lib/titles/registry`, `describeModel`/`computeDefaults` (Task 1).
- Produces:
  ```ts
  export type TitleOption = { key: string; name: string; color: string | null; isFullScreen: boolean; fields: FieldDescriptor[]; defaults: Record<string, unknown> }
  export function listTitleOptions(packageLabel: string): TitleOption[]
  export async function getProjectLabel(projectId: string): Promise<string | null>
  export function GET(req, { params }) // route
  ```
  Consumed by Tasks 7 (slice) and 9 (UI).

- [ ] **Step 1: Write the failing unit test for `listTitleOptions`** (mock the registry so it is data-driven, not dependent on shipped packages)

```ts
// test/titles/listTitleOptions.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
vi.mock('@/lib/titles/registry', () => ({
  listTitles: () => [
    { key: 'lower-third', model: z.object({ playerName: z.string().min(1).max(40) }),
      settings: { title_name: 'Lower Third', title_color: 'red', title_is_full_screen: false } },
  ],
}))
const { listTitleOptions } = await import('@/lib/titles/listTitleOptions')

it('maps each registry title to an option with descriptors + defaults', () => {
  const [opt] = listTitleOptions('default')
  expect(opt).toMatchObject({ key: 'lower-third', name: 'Lower Third', color: 'red', isFullScreen: false })
  expect(opt.fields[0]).toMatchObject({ name: 'playerName', kind: 'string' })
  expect(opt.defaults.playerName).toBe('')
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `getProjectLabel.ts` and `listTitleOptions.ts`**

```ts
// lib/projects/getProjectLabel.ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects } from '@/db/schema'
export async function getProjectLabel(projectId: string): Promise<string | null> {
  const [row] = await db.select({ label: projects.label }).from(projects).where(eq(projects.id, projectId)).limit(1)
  return row?.label ?? null
}
```

```ts
// lib/titles/listTitleOptions.ts
import { listTitles } from './registry'
import { describeModel, computeDefaults, type FieldDescriptor } from './describeModel'

export type TitleOption = {
  key: string; name: string; color: string | null; isFullScreen: boolean
  fields: FieldDescriptor[]; defaults: Record<string, unknown>
}

export function listTitleOptions(packageLabel: string): TitleOption[] {
  return listTitles(packageLabel).map((t) => ({
    key: t.key,
    name: t.settings.title_name,
    color: t.settings.title_color ?? null,
    isFullScreen: t.settings.title_is_full_screen,
    fields: describeModel(t.model),
    defaults: computeDefaults(t.model),
  }))
}
```

- [ ] **Step 4: Implement the route** (`titles/route.ts`)

```ts
import { auth } from '@/lib/auth'
import { getProjectLabel } from '@/lib/projects/getProjectLabel'
import { listTitleOptions } from '@/lib/titles/listTitleOptions'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const label = await getProjectLabel(projectId)
  if (!label) return new Response('Not found', { status: 404 })
  return Response.json(listTitleOptions(label))
}
```

- [ ] **Step 5: Write the route test** (`test/app/api/project-titles.test.ts`): mock `@/lib/auth`, `@/lib/projects/getProjectLabel`, `@/lib/titles/listTitleOptions`; assert 401 no session, 404 unknown project, 200 returns the options array.

- [ ] **Step 6: Run both tests → PASS**, then **Step 7: Commit**

```bash
git add lib/projects/getProjectLabel.ts lib/titles/listTitleOptions.ts "app/api/projects/[projectId]/titles/route.ts" test/titles/listTitleOptions.test.ts test/app/api/project-titles.test.ts
git commit -m "feat(titles): project titles endpoint serving field descriptors + defaults"
```

---

### Task 7: RTK Query slices + store registration

**Files:**
- Create: `store/apis/rundownItemsApi.ts`, `store/apis/titlesApi.ts`
- Modify: `store/index.ts`, `test/store/store.test.ts`
- Test: `test/store/apis/rundownItemsApi.test.ts`

**Interfaces:**
- Consumes: `RundownItem` (Task 2), `TitleOption` (Task 6),
  `CreateRundownItemInput`/`UpdateRundownItemInput` (Task 2).
- Produces hooks:
  `useListItemsQuery`, `useCreateItemMutation`, `useUpdateItemMutation`,
  `useDeleteItemMutation`, `useReorderItemsMutation`, `useListTitlesQuery`.
  Consumed by Task 9.

- [ ] **Step 1: Write the failing test** (endpoint-shape, mirroring `test/store/apis/createEntityApi.test.ts`)

```ts
// test/store/apis/rundownItemsApi.test.ts
import { describe, it, expect } from 'vitest'
import { rundownItemsApi } from '@/store/apis/rundownItemsApi'
import { titlesApi } from '@/store/apis/titlesApi'

it('rundownItemsApi exposes list/create/update/delete/reorder endpoints', () => {
  expect(Object.keys(rundownItemsApi.endpoints)).toEqual(
    expect.arrayContaining(['listItems', 'createItem', 'updateItem', 'deleteItem', 'reorderItems']),
  )
})
it('titlesApi exposes listTitles', () => {
  expect(Object.keys(titlesApi.endpoints)).toEqual(expect.arrayContaining(['listTitles']))
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `rundownItemsApi.ts`**

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RundownItem } from '@/lib/entities/rundown-items'
import type { CreateRundownItemInput, UpdateRundownItemInput } from '@/db/schemas/rundown-items'

const base = (projectId: string, rundownId: string) =>
  `/projects/${projectId}/rundowns/${rundownId}/items`

export const rundownItemsApi = createApi({
  reducerPath: 'rundownItemsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Item'],
  endpoints: (b) => ({
    listItems: b.query<RundownItem[], { projectId: string; rundownId: string }>({
      query: ({ projectId, rundownId }) => base(projectId, rundownId),
      providesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    createItem: b.mutation<RundownItem, { projectId: string; rundownId: string; data: CreateRundownItemInput }>({
      query: ({ projectId, rundownId, data }) => ({ url: base(projectId, rundownId), method: 'POST', body: data }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    updateItem: b.mutation<RundownItem, { projectId: string; rundownId: string; itemId: string; data: UpdateRundownItemInput }>({
      query: ({ projectId, rundownId, itemId, data }) => ({ url: `${base(projectId, rundownId)}/${itemId}`, method: 'PATCH', body: data }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    deleteItem: b.mutation<void, { projectId: string; rundownId: string; itemId: string }>({
      query: ({ projectId, rundownId, itemId }) => ({ url: `${base(projectId, rundownId)}/${itemId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    reorderItems: b.mutation<RundownItem[], { projectId: string; rundownId: string; orderedIds: string[] }>({
      query: ({ projectId, rundownId, orderedIds }) => ({ url: `${base(projectId, rundownId)}/order`, method: 'PUT', body: { orderedIds } }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
  }),
})

export const {
  useListItemsQuery, useCreateItemMutation, useUpdateItemMutation,
  useDeleteItemMutation, useReorderItemsMutation,
} = rundownItemsApi
```

- [ ] **Step 4: Implement `titlesApi.ts`**

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { TitleOption } from '@/lib/titles/listTitleOptions'

export const titlesApi = createApi({
  reducerPath: 'titlesApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    listTitles: b.query<TitleOption[], { projectId: string }>({
      query: ({ projectId }) => `/projects/${projectId}/titles`,
    }),
  }),
})

export const { useListTitlesQuery } = titlesApi
```

- [ ] **Step 5: Register both in `store/index.ts`** — add imports, a `rootReducer`
  entry, and a `middleware` entry for each (follow the `rundownsApi` lines).

- [ ] **Step 6: Update `test/store/store.test.ts`** — import `rundownItemsApi`
  and `titlesApi`, add a test asserting both reducers are defined in state.

- [ ] **Step 7: Run `npx vitest run test/store` → PASS**, then commit

```bash
git add store/apis/rundownItemsApi.ts store/apis/titlesApi.ts store/index.ts test/store/apis/rundownItemsApi.test.ts test/store/store.test.ts
git commit -m "feat(store): rundownItemsApi + titlesApi slices, registered in store"
```

---

### Task 8: `TitleDataForm` component

**Files:**
- Create: `components/admin/rundown/TitleDataForm.tsx`
- Test: `test/components/admin/rundown/TitleDataForm.test.tsx`

**Interfaces:**
- Consumes: `FieldDescriptor` (Task 1).
- Produces:
  ```ts
  export function TitleDataForm(props: {
    fields: FieldDescriptor[]
    defaultValues: Record<string, unknown>
    onSubmit: (values: Record<string, unknown>) => Promise<{ fieldErrors?: Record<string, string[]> } | void>
    saving?: boolean
  }): JSX.Element
  ```
  Prop-driven and store-free (testable like `ExtraMapField`). Consumed by Task 9.

- [ ] **Step 1: Write the failing test**

```tsx
// test/components/admin/rundown/TitleDataForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TitleDataForm } from '@/components/admin/rundown/TitleDataForm'
import type { FieldDescriptor } from '@/lib/titles/describeModel'

const fields: FieldDescriptor[] = [
  { name: 'playerName', label: 'Player Name', kind: 'string', required: true, minLength: 1, maxLength: 40, multiline: false },
  { name: 'position', label: 'Position', kind: 'enum', required: false, options: ['guard', 'forward'] },
]

it('renders one input per descriptor and submits values', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<TitleDataForm fields={fields} defaultValues={{ playerName: 'Jo', position: 'guard' }} onSubmit={onSubmit} />)
  expect(screen.getByLabelText('Player Name')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ playerName: 'Jo', position: 'guard' })))
})

it('shows a field badge when onSubmit returns fieldErrors', async () => {
  const onSubmit = vi.fn().mockResolvedValue({ fieldErrors: { playerName: ['Required'] } })
  render(<TitleDataForm fields={fields} defaultValues={{ playerName: '' }} onSubmit={onSubmit} />)
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `TitleDataForm.tsx`** — `useForm({ defaultValues })`; map
  each descriptor through a `renderField` switch (`string`→`TextField`
  `multiline={f.multiline}`; `number`→`TextField type="number"` with
  `onChange` coercing to Number; `enum`→`TextField select` with `MenuItem`s;
  `boolean`→MUI `Checkbox` + label; `stringArray`→a minimal add/remove list of
  `TextField`s). A `<Button type="submit">Save</Button>` (disabled when
  `saving`). In the submit handler, `await onSubmit(values)`; if it returns
  `{ fieldErrors }`, `Object.entries` → `setError(name, { message: msgs.join(', ') })`.
  Show errors via each field's `helperText`/`error` from `fieldState`.

- [ ] **Step 4: Run → PASS**, then **Step 5: Commit**

```bash
git add components/admin/rundown/TitleDataForm.tsx test/components/admin/rundown/TitleDataForm.test.tsx
git commit -m "feat(rundown): TitleDataForm — descriptor-driven data form with server-error badges"
```

---

### Task 9: Add Template modal + item list (wire the rundown page)

**Files:**
- Create: `components/admin/rundown/AddTemplateModal.tsx`, `components/admin/rundown/RundownItemRow.tsx`
- Modify: `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`
- Test: `test/components/admin/rundown/AddTemplateModal.test.tsx`

**Interfaces:**
- Consumes: `useListItemsQuery`, `useCreateItemMutation`, `useUpdateItemMutation`,
  `useDeleteItemMutation`, `useReorderItemsMutation`, `useListTitlesQuery` (Task 7);
  `TitleDataForm` (Task 8); `TitleOption` (Task 6); `RundownItem` (Task 2);
  `getErrorMessage` (`@/lib/errors/getErrorMessage`).

**Behavior:**
- `AddTemplateModal` — a Dialog: a `select` of `TitleOption`s (label = `name`,
  with a color swatch) + optional `label` text field. Submit calls
  `createItem({ projectId, rundownId, data: { titleKey, label, data: option.defaults } })`,
  then closes. Requires a chosen title.
- `RundownItemRow` — one row: title name (looked up from the options by
  `titleKey`), `label`, color chip, ▲/▼ buttons (disabled at ends → call
  `onReorder` with swapped order), Delete, and an expand toggle that reveals a
  `TitleDataForm` (fields/defaults from the item's `TitleOption`, values from the
  item's `data`). Save calls `updateItem` and, on a 400, returns
  `{ fieldErrors }` parsed from the RTK error payload for the badges.
- The page composes the list + Add Template, keeping the existing rundown
  rename/delete. Item count replaces the hardcoded `0 items`.

- [ ] **Step 1: Write the failing test for `AddTemplateModal`** (render with a
  provider wrapping `titlesApi`/`rundownItemsApi`, or pass options + an
  `onCreate` callback prop to keep it store-free — prefer the callback prop so
  the test is store-free like Task 8):

```tsx
// test/components/admin/rundown/AddTemplateModal.test.tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddTemplateModal } from '@/components/admin/rundown/AddTemplateModal'
import type { TitleOption } from '@/lib/titles/listTitleOptions'

const options: TitleOption[] = [
  { key: 'lower-third', name: 'Lower Third', color: 'red', isFullScreen: false, fields: [], defaults: { playerName: '' } },
]

it('creates an item with the chosen title and its defaults', async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined)
  render(<AddTemplateModal open options={options} onClose={vi.fn()} onCreate={onCreate} />)
  fireEvent.mouseDown(screen.getByLabelText(/template/i))
  fireEvent.click(await screen.findByText('Lower Third'))
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ titleKey: 'lower-third', data: { playerName: '' } })))
})
```

  Design `AddTemplateModal` to take `options`, `onClose`, `onCreate(payload)` as
  props (the page supplies `onCreate` wired to `createItem`), so the component is
  store-free and unit-testable. `RundownItemRow` likewise takes data + callbacks
  as props. The page owns all RTK hooks.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `AddTemplateModal.tsx`** (prop-driven, per the test).

- [ ] **Step 4: Implement `RundownItemRow.tsx`** (prop-driven: `item`, `option`,
  `isFirst`, `isLast`, `onReorderUp/Down`, `onDelete`, `onSaveData`).

- [ ] **Step 5: Rewire the page** — add RTK hooks (`useListTitlesQuery`,
  `useListItemsQuery`, and the mutations), render the ordered list of
  `RundownItemRow`s, the Add Template button+modal, keep rename/delete, and
  replace `0 items` with the real count. Reorder ▲/▼ builds the new `orderedIds`
  and calls `reorderItems`. Map a mutation's rejected 400 payload
  (`{ fieldErrors }`) back into `TitleDataForm` via its `onSubmit` return.

- [ ] **Step 6: Run `npx vitest run test/components/admin/rundown` → PASS.**

- [ ] **Step 7: Verify the full app builds and typechecks**

Run: `npm run build` (regenerates `.next/types`; catches route/type errors).
Expected: clean build; `/projects/[projectId]/rundowns/[rundownId]` present.

- [ ] **Step 8: Commit**

```bash
git add components/admin/rundown/AddTemplateModal.tsx components/admin/rundown/RundownItemRow.tsx "app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx" test/components/admin/rundown/AddTemplateModal.test.tsx
git commit -m "feat(rundown): Add Template modal + item list with reorder and inline data editing"
```

---

### Task 10: Audit + docs sync

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-06-18-base-app-scope.md`, `docs/rundowns.md`

- [ ] **Step 1: Run the seeded-UUID audit** (spec requirement)

Run: `grep -rn "00000000-0000" app lib`
Expected: **no output**. If anything matches, replace it with a URL-derived
`projectId` before continuing.

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all tests pass; lint 0 errors (warnings as per baseline).

- [ ] **Step 3: Update `docs/superpowers/specs/2026-06-18-base-app-scope.md`** —
  mark `P5a` **✅ done** in the status table; note that layer + per-item color
  were deferred to P5b (as already planned) and P5a shipped migration-free.

- [ ] **Step 4: Update `CLAUDE.md`** — in the P-status/decisions notes, record
  that rundown-item CRUD (route + dynamic model validation + descriptor-driven
  form) shipped in P5a; `rundown_items.layer` remains the pending P5b migration.

- [ ] **Step 5: Update `docs/rundowns.md`** — replace any "item CRUD is P5a, not
  yet built" language with the shipped endpoints
  (`/api/projects/[projectId]/rundowns/[rundownId]/items[/order|/[itemId]]`,
  `/api/projects/[projectId]/titles`) and the descriptor/validation contract.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-06-18-base-app-scope.md docs/rundowns.md
git commit -m "docs: mark P5a rundown-item CRUD done; record layer/color deferral to P5b"
```

---

## Self-Review notes (author)

- **Spec coverage:** gallery/nav/rundown CRUD already shipped (design §"already
  exists"); this plan covers items API (T3–5), titles endpoint (T6), slices
  (T7), descriptor form (T1, T8), Add Template + list + reorder (T9), the
  seeded-UUID audit and acceptance (T10). All design sections map to a task.
- **Migration-free:** no `db:generate`/`db:migrate` step anywhere; no `layer`/
  `color` column. Honored.
- **Type consistency:** `FieldDescriptor` (T1) → T6/T8/T9; `RundownItem` (T2) →
  T7/T9; `TitleOption` (T6) → T7/T9; hook names in T7 match those consumed in T9.
- **Zod introspection risk** is isolated to T1 with the test as oracle; every
  other task mocks the registry/model, so a Zod-shape surprise can't cascade.
