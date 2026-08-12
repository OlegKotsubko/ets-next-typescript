# Workspace Nav + Rundowns List/Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Data/Rundowns/Midi workspace header to every `/admin/[projectId]/*` page, and stand up rundown list + create (no edit/delete, no editor UI, no broadcast yet).

**Architecture:** A new `app/admin/[projectId]/layout.tsx` server component does the authoritative session check (currently missing on `/admin/[projectId]/data`) and renders the header with active-link highlighting. `rundowns` already exists in `db/schema.ts` (migrated); new schema/route/client-API files for it follow the exact `players` entity pattern (`db/schemas/*.ts` → `createCrudHandlers` → `createEntityApi`). One hand-written single-row GET route is added because `createCrudHandlers`'s `GET` only supports project-scoped *list* (see Task 2 note) — no existing entity in this codebase has a working single-row fetch endpoint.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Neon Postgres, HTTP driver), Zod, RTK Query, MUI v6, Vitest.

## Global Constraints

- Every entity API route lives under `/api/projects/[projectId]/...` and derives `projectId` from the URL, never the body (`CLAUDE.md`).
- `proxy.ts` only checks session-cookie *presence* as a fast path; `auth.api.getSession()` is the authoritative per-request check and must run in the layout/page itself (`app/admin/page.tsx`'s existing pattern).
- MUI for admin UI; no SCSS/inline hex here — this is all admin chrome, not a title component (`CLAUDE.md` split-UI rule).
- Nav label is **"Rundowns"** at route `/admin/[projectId]/rundowns` — an intentional deviation from `docs/rundowns.md`'s "Overlays" rename (see spec's "Naming" section). Do not "correct" this back during implementation.
- "Midi" renders as a disabled, non-navigating element — no `href`, `aria-disabled="true"`.
- Branch `p5-rundowns-list` already exists and is checked out (created before this plan was written) — do not create it again.

---

### Task 1: Rundown schema + list/create routes

**Files:**
- Create: `db/schemas/rundowns.ts`
- Create: `app/api/projects/[projectId]/rundowns/route.ts`
- Test: `test/app/api/rundowns.test.ts`

**Interfaces:**
- Consumes: `rundowns` table from `db/schema.ts` (already has `id`, `projectId`, `name`, `ownerId`, `createdAt`, `updatedAt`); `createCrudHandlers` from `@/lib/crud/createCrudHandlers`.
- Produces: `createRundownSchema`, `updateRundownSchema`, `CreateRundownInput`, `UpdateRundownInput` (from `db/schemas/rundowns.ts`) — consumed by Task 2 and Task 3. Route exports `GET` (list, 401/200) and `POST` (create, 401/400/201) at `/api/projects/[projectId]/rundowns`.

- [ ] **Step 1: Write the failing test**

```ts
// test/app/api/rundowns.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { GET, POST } = await import('@/app/api/projects/[projectId]/rundowns/route')

const PROJECT_A = '11111111-1111-1111-1111-111111111111'

function req(body?: unknown, method = 'POST') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}

function ctx(projectId = PROJECT_A) {
  return { params: Promise.resolve({ projectId }) }
}

describe('GET/POST /api/projects/[projectId]/rundowns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(req(undefined, 'GET'), ctx())
    expect(res.status).toBe(401)
  })

  it('GET returns rows scoped to projectId on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const rows = [{ id: 'r1', projectId: PROJECT_A, name: 'Finals Night' }]
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }) })
    const res = await GET(req(undefined, 'GET'), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
  })

  it('POST returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await POST(req({ name: 'Finals Night' }), ctx())
    expect(res.status).toBe(401)
  })

  it('POST returns 400 on empty name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({ name: '' }), ctx())
    expect(res.status).toBe(400)
  })

  it('POST returns 400 on missing name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(400)
  })

  it('POST returns 201 and the inserted row, projectId taken from the URL not the body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const row = { id: 'r1', projectId: PROJECT_A, name: 'Finals Night' }
    const returning = vi.fn().mockResolvedValue([row])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await POST(req({ name: 'Finals Night', projectId: 'someone-elses-id' }), ctx())
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(row)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT_A, name: 'Finals Night' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/app/api/rundowns.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/projects/[projectId]/rundowns/route'` (or similar, since neither the schema file nor route file exist yet).

- [ ] **Step 3: Write the schema file**

```ts
// db/schemas/rundowns.ts
import { z } from 'zod'

export const createRundownSchema = z.object({
  name: z.string().min(1).max(120),
})
export const updateRundownSchema = createRundownSchema.partial()
export type CreateRundownInput = z.infer<typeof createRundownSchema>
export type UpdateRundownInput = z.infer<typeof updateRundownSchema>
```

- [ ] **Step 4: Write the route file**

```ts
// app/api/projects/[projectId]/rundowns/route.ts
import { rundowns } from '@/db/schema'
import { createRundownSchema, updateRundownSchema } from '@/db/schemas/rundowns'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: rundowns, createSchema: createRundownSchema, updateSchema: updateRundownSchema })
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/app/api/rundowns.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add db/schemas/rundowns.ts "app/api/projects/[projectId]/rundowns/route.ts" test/app/api/rundowns.test.ts
git commit -m "feat(rundowns): add list/create API route"
```

---

### Task 2: Single-rundown GET route

**Note on why this isn't `createCrudHandlers` again:** `createCrudHandlers`'s `GET` handler *only* implements the project-scoped list query (`db.select().from(table).where(eq(table.projectId, projectId))`) — it ignores any `id` route param entirely. No entity in this codebase currently has a working single-row fetch endpoint (confirmed: `players`, `videos`, etc. only export `PATCH`/`DELETE` from their `[id]/route.ts` files). The stub page (Task 6) needs to fetch one rundown by id and distinguish "not found" from "found", so this task hand-writes that one route rather than extending the shared factory (out of scope — the factory is used by 8 other entities and changing its `GET` semantics is a bigger, riskier change than this pass needs).

**Files:**
- Create: `app/api/projects/[projectId]/rundowns/[id]/route.ts`
- Test: `test/app/api/rundowns-id.test.ts`

**Interfaces:**
- Consumes: `rundowns` table, `auth` from `@/lib/auth`, `db` from `@/db`.
- Produces: `GET` at `/api/projects/[projectId]/rundowns/[id]` — 401 no session, 404 not found (or found but wrong `projectId`), 200 + row on success. Consumed by Task 3's `useGetRundownQuery` and Task 6's stub page.

- [ ] **Step 1: Write the failing test**

```ts
// test/app/api/rundowns-id.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { GET } = await import('@/app/api/projects/[projectId]/rundowns/[id]/route')

const PROJECT_A = '11111111-1111-1111-1111-111111111111'
const ROW_ID = '22222222-2222-2222-2222-222222222222'

function req() {
  return new Request('http://localhost/x', { method: 'GET' })
}

function ctx(projectId = PROJECT_A, id = ROW_ID) {
  return { params: Promise.resolve({ projectId, id }) }
}

describe('GET /api/projects/[projectId]/rundowns/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(req(), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 404 when no row matches', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
    const res = await GET(req(), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 200 and the row when found', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const row = { id: ROW_ID, projectId: PROJECT_A, name: 'Finals Night' }
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([row]) }) })
    const res = await GET(req(), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(row)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/app/api/rundowns-id.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/projects/[projectId]/rundowns/[id]/route'`

- [ ] **Step 3: Write the route**

```ts
// app/api/projects/[projectId]/rundowns/[id]/route.ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { projectId, id } = await params
  const [row] = await db.select().from(rundowns).where(and(eq(rundowns.id, id), eq(rundowns.projectId, projectId)))
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/app/api/rundowns-id.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/projects/[projectId]/rundowns/[id]/route.ts" test/app/api/rundowns-id.test.ts
git commit -m "feat(rundowns): add single-rundown GET route"
```

---

### Task 3: Client entity type + RTK Query slice, wired into the store

**Files:**
- Create: `lib/entities/rundowns.ts`
- Create: `store/apis/rundownsApi.ts`
- Modify: `store/index.ts`

**Interfaces:**
- Consumes: `createEntityApi` from `./createEntityApi`; `CreateRundownInput`, `UpdateRundownInput` from `@/db/schemas/rundowns` (Task 1); the two route handlers from Tasks 1–2.
- Produces: `Rundown` type; `useListRundownsQuery(projectId: string)`, `useCreateRundownMutation()`, `useGetRundownQuery({ projectId, id })` — consumed by Task 5 (list/create page) and Task 6 (stub page).

- [ ] **Step 1: Write the entity type**

```ts
// lib/entities/rundowns.ts
export type Rundown = {
  id: string
  projectId: string
  name: string
  ownerId: string | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Write the RTK Query slice**

```ts
// store/apis/rundownsApi.ts
import { createEntityApi } from './createEntityApi'
import type { Rundown } from '@/lib/entities/rundowns'
import type { CreateRundownInput, UpdateRundownInput } from '@/db/schemas/rundowns'

const { api } = createEntityApi<Rundown, CreateRundownInput, UpdateRundownInput>({
  reducerPath: 'rundownsApi',
  tagType: 'Rundown',
  basePath: 'rundowns',
})

export const rundownsApi = api

const hooks = api as any
export const useListRundownsQuery = hooks.useListRundownsQuery
export const useGetRundownQuery = hooks.useGetRundownQuery
export const useCreateRundownMutation = hooks.useCreateRundownMutation
```

- [ ] **Step 3: Wire into the store**

In `store/index.ts`, add the import alongside the other entity API imports:

```ts
import { rundownsApi } from './apis/rundownsApi'
```

Add to the `combineReducers` object (after `overlayPackagesApi`):

```ts
  [rundownsApi.reducerPath]: rundownsApi.reducer,
```

Add to the `entityMiddleware` array (after `overlayPackagesApi.middleware`):

```ts
  rundownsApi.middleware,
```

- [ ] **Step 4: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/entities/rundowns.ts store/apis/rundownsApi.ts store/index.ts
git commit -m "feat(rundowns): add client entity type and RTK Query slice"
```

---

### Task 4: Shared workspace layout with Data/Rundowns/Midi nav

**Files:**
- Create: `app/admin/[projectId]/layout.tsx`
- Create: `app/admin/[projectId]/WorkspaceNav.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `headers` from `next/headers`, `redirect`/`notFound` from `next/navigation`, `db` from `@/db`, `projects` table from `@/db/schema`.
- Produces: every page under `app/admin/[projectId]/*` (existing `data/*` pages, and the new `rundowns/*` pages from Tasks 5–6) is now wrapped by this layout automatically — no changes needed in those pages to receive the header. `WorkspaceNav` takes `{ projectId: string }` and renders the three links, exported for potential reuse (none needed this pass).

- [ ] **Step 1: Write the active-link nav component**

```tsx
// app/admin/[projectId]/WorkspaceNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, Tab, Box } from '@mui/material'

export default function WorkspaceNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const dataHref = `/admin/${projectId}/data`
  const rundownsHref = `/admin/${projectId}/rundowns`

  const value = pathname.startsWith(rundownsHref) ? rundownsHref : dataHref

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value}>
        <Tab label="Data"
          value={dataHref}
          component={Link}
          href={dataHref} />
        <Tab label="Rundowns"
          value={rundownsHref}
          component={Link}
          href={rundownsHref} />
        <Tab label="Midi"
          value="midi-disabled"
          disabled
          aria-disabled="true" />
      </Tabs>
    </Box>
  )
}
```

`Tabs` requires its `value` to match one of its children's `value`s or none renders selected — the disabled "Midi" tab is given a `value` (`"midi-disabled"`) that never matches `pathname`-derived `value`, so it's never shown as active but MUI's controlled-`Tabs` invariant (every `Tab` needs a `value`) is still satisfied.

- [ ] **Step 2: Write the layout**

```tsx
// app/admin/[projectId]/layout.tsx
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Box, Typography } from '@mui/material'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { projects } from '@/db/schema'
import WorkspaceNav from './WorkspaceNav'

// proxy.ts only checks cookie presence; this is the authoritative check,
// covering every page under /admin/[projectId]/* (data/*, rundowns/*).
export default async function ProjectWorkspaceLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const { projectId } = await params
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
  if (!project) notFound()

  return (
    <Box>
      <Box sx={{ px: 4, pt: 3 }}>
        <Typography variant="h5">
          {project.name}
        </Typography>
      </Box>
      <Box sx={{ px: 4 }}>
        <WorkspaceNav projectId={projectId} />
      </Box>
      {children}
    </Box>
  )
}
```

- [ ] **Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/[projectId]/layout.tsx" "app/admin/[projectId]/WorkspaceNav.tsx"
git commit -m "feat(admin): add persistent Data/Rundowns/Midi workspace nav"
```

---

### Task 5: Rundowns list + create page

**Files:**
- Create: `lib/errors/getErrorMessage.ts`
- Create: `app/admin/[projectId]/rundowns/page.tsx`

**Interfaces:**
- Consumes: `useListRundownsQuery`, `useCreateRundownMutation` from `@/store/apis/rundownsApi` (Task 3).
- Produces: `/admin/[projectId]/rundowns` route, cards linking to `/admin/[projectId]/rundowns/[rundownId]` (consumed by Task 6). `getErrorMessage(err, fallback)` from `lib/errors/getErrorMessage.ts` — a reusable extraction of the RTK Query error-shape parsing that was previously duplicated inline in `app/admin/AdminGallery.tsx`; only the new page uses it this pass (leaving `AdminGallery.tsx` untouched avoids an unrelated-risk refactor of already-shipped code).

- [ ] **Step 1: Extract the shared error-message helper**

```ts
// lib/errors/getErrorMessage.ts
// Parses the error shapes RTK Query mutations reject with: an unwrapped
// fetchBaseQuery error (`{ data: { message | error } }` or `{ data: string }`)
// or a plain `{ message }` / `{ error }` object.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    if ('data' in err) {
      const data = (err as { data?: unknown }).data
      if (data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string') {
        return (data as { message: string }).message
      }
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
        return (data as { error: string }).error
      }
      if (typeof data === 'string') return data
    }
    if ('error' in err && typeof (err as { error?: unknown }).error === 'string') {
      return (err as { error: string }).error
    }
    if ('message' in err && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message
    }
  }
  return fallback
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/admin/[projectId]/rundowns/page.tsx
'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardActionArea, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import { useListRundownsQuery, useCreateRundownMutation } from '@/store/apis/rundownsApi'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'

export default function RundownsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: rundowns = [], isError } = useListRundownsQuery(projectId)
  const [createRundown, { isLoading }] = useCreateRundownMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  function closeDialog() {
    setOpen(false)
    setCreateError(null)
  }

  async function handleCreate() {
    setCreateError(null)
    try {
      await createRundown({ projectId, data: { name } }).unwrap()
      setName('')
      setOpen(false)
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Failed to create rundown. Please try again.'))
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
Rundowns
        </Typography>
      </Box>

      <Button variant="contained"
        onClick={() => setOpen(true)}
        sx={{ mb: 3 }}>
        Add Rundown
      </Button>

      {isError && (
        <Alert severity="error"
          sx={{ mb: 2 }}>
          Failed to load rundowns — please refresh.
        </Alert>
      )}

      {!isError && rundowns.length === 0 && (
        <Typography color="text.secondary">
No rundowns yet — click Add Rundown to create one.
        </Typography>
      )}

      <Grid container
        spacing={2}>
        {rundowns.map((r) => (
          <Grid key={r.id}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea component={Link}
                href={`/admin/${projectId}/rundowns/${r.id}`}>
                <CardContent>
                  <Typography variant="h6">
                    {r.name}
                  </Typography>
                  <Typography variant="body2"
                    color="text.secondary">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
Add Rundown
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {createError && <Alert severity="error">
            {createError}
          </Alert>}
          <TextField label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>
Cancel
          </Button>
          <Button variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || isLoading}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
```

- [ ] **Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/errors/getErrorMessage.ts "app/admin/[projectId]/rundowns/page.tsx"
git commit -m "feat(rundowns): add rundowns list + create page"
```

---

### Task 6: Rundown stub page

**Files:**
- Create: `app/admin/[projectId]/rundowns/[rundownId]/page.tsx`

**Interfaces:**
- Consumes: `useGetRundownQuery` from `@/store/apis/rundownsApi` (Task 3).
- Produces: `/admin/[projectId]/rundowns/[rundownId]` route — the destination for cards created in Task 5.

- [ ] **Step 1: Write the page**

```tsx
// app/admin/[projectId]/rundowns/[rundownId]/page.tsx
'use client'
import { use } from 'react'
import Link from 'next/link'
import { Box, Typography, CircularProgress } from '@mui/material'
import { useGetRundownQuery } from '@/store/apis/rundownsApi'

export default function RundownStubPage({
  params,
}: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: rundown, isLoading, isError } = useGetRundownQuery({ projectId, id: rundownId })

  return (
    <Box sx={{ p: 4 }}>
      <Link href={`/admin/${projectId}/rundowns`}>
        ← Back to Rundowns
      </Link>

      {isLoading && (
        <Box sx={{ mt: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {isError && (
        <Typography sx={{ mt: 3 }}
          color="error">
          Rundown not found.
        </Typography>
      )}

      {rundown && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4"
            gutterBottom>
            {rundown.name}
          </Typography>
          <Typography color="text.secondary">
0 items
          </Typography>
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/[projectId]/rundowns/[rundownId]/page.tsx"
git commit -m "feat(rundowns): add rundown stub page"
```

---

### Task 7: Full test suite + manual verification

**Files:** none created — verification only.

**Interfaces:** none — this task exercises everything from Tasks 1–6 together.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: all tests pass, including the new `test/app/api/rundowns.test.ts` and `test/app/api/rundowns-id.test.ts`. (`test/app/title-preview.test.tsx` is a pre-existing, unrelated failure — ignore it if present.)

- [ ] **Step 2: Run typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification via dev server**

Run: `npm run dev` (or `netlify dev` if Netlify Blobs/env vars are needed elsewhere), then in a browser:

1. Log in, open an existing project's `/admin/[projectId]/data`. Confirm the header now shows the project name, then **Data** (highlighted as active), **Rundowns**, and a visibly greyed-out, unclickable **Midi**.
2. Click **Rundowns**. Confirm navigation to `/admin/[projectId]/rundowns`, the header updates with **Rundowns** highlighted instead, and (assuming none exist yet for this project) the "No rundowns yet" empty state renders.
3. Click **Add Rundown**, type a name, click **Create**. Confirm the dialog closes and the new rundown appears in the list without a manual page refresh.
4. Click the new rundown's card. Confirm navigation to `/admin/[projectId]/rundowns/[rundownId]`, showing its name and "0 items", with a working "← Back to Rundowns" link.
5. Click **Midi**. Confirm nothing happens — no navigation, no console error.
6. Manually edit the URL to a rundown id that doesn't exist (e.g. change one digit). Confirm "Rundown not found." renders instead of a crash.
7. Manually edit the URL's `projectId` to a *different* real project's id while keeping the rundown id from step 3. Confirm "Rundown not found." renders (proves `project_id` isolation on the single-row GET route).

- [ ] **Step 4: Commit if any fixes were needed**

If steps 1–3 required code changes, commit them now with a descriptive message. If everything passed as-is, this task needs no commit.
