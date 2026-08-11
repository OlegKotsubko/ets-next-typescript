# Project Gallery + Creation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin` placeholder with a real project gallery — list existing projects, create new ones via an "Add Project" dialog, and link into each project's Data workspace.

**Architecture:** Two small server routes (`GET/POST /api/projects`, `GET /api/overlay-packages`) backed by the already-existing `projects` table/schema and `lib/projects/packages.ts` helpers. Two hand-written RTK Query slices (not the generic `createEntityApi` factory — projects sit above the `project_id` hierarchy). `/admin` becomes a client page: a card grid plus an "Add Project" `Dialog`.

**Tech Stack:** Next.js 16 App Router (Node runtime), Drizzle ORM + Neon Postgres, Zod, MUI, Redux Toolkit + RTK Query, Vitest.

## Global Constraints

- Every route requires a session (`auth.api.getSession`); 401 without one. (docs/database.md, existing pattern in `lib/crud/createCrudHandlers.ts`)
- `POST /api/projects` must reject a `label` that doesn't match a real overlay-package folder — call `packageExists(body.label)` from `lib/projects/packages.ts` and return 400 if it's false. (docs/projects-system.md)
- `createProjectSchema` and the `projects` table already exist in `db/schema.ts` — do not redefine them, import and reuse.
- No `project_picture` upload UI in this pass — the field stays in the schema/table, unused by the form.
- No `/admin/[projectId]/overlays` link on project cards — that page doesn't exist yet.
- Not built on `createCrudHandlers`/`createEntityApi`/`<CrudPage>` — those assume `/api/projects/[projectId]/...` scoping, which doesn't apply to the projects collection itself.

---

## Task 1: `GET`/`POST /api/projects` route

**Files:**
- Create: `app/api/projects/route.ts`
- Test: `test/app/api/projects.test.ts`

**Interfaces:**
- Consumes: `projects` table, `createProjectSchema` (both already in `db/schema.ts`), `packageExists` (`lib/projects/packages.ts`), `auth` (`lib/auth.ts`), `db` (`db/index.ts`).
- Produces: `GET`/`POST` handlers returning `Project` rows — consumed by Task 3's `store/apis/projectsApi.ts` as the HTTP contract (`GET /api/projects` → `Project[]`, `POST /api/projects` → `Project` with 201).

- [ ] **Step 1: Write the failing tests**

```ts
// test/app/api/projects.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const packageExistsMock = vi.fn()
vi.mock('@/lib/projects/packages', () => ({ packageExists: (...args: unknown[]) => packageExistsMock(...args) }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { GET, POST } = await import('@/app/api/projects/route')

function req(body?: unknown, method = 'POST') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}

describe('GET/POST /api/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(req(undefined, 'GET'))
    expect(res.status).toBe(401)
  })

  it('GET returns all rows on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const rows = [{ id: 'p1', name: 'Test Event' }]
    dbMock.select.mockReturnValue({ from: vi.fn().mockResolvedValue(rows) })
    const res = await GET(req(undefined, 'GET'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
  })

  it('POST returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await POST(req({ name: 'x', mode: 'team_vs_team', label: 'default' }))
    expect(res.status).toBe(401)
  })

  it('POST returns 400 on invalid body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({ name: '', mode: 'team_vs_team', label: 'default' }))
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when label does not match a real package', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    packageExistsMock.mockReturnValue(false)
    const res = await POST(req({ name: 'Test Event', mode: 'team_vs_team', label: 'nonexistent' }))
    expect(res.status).toBe(400)
    expect(packageExistsMock).toHaveBeenCalledWith('nonexistent')
  })

  it('POST returns 201 and the inserted row on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    packageExistsMock.mockReturnValue(true)
    const row = { id: 'p1', name: 'Test Event', mode: 'team_vs_team', label: 'default' }
    const returning = vi.fn().mockResolvedValue([row])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await POST(req({ name: 'Test Event', mode: 'team_vs_team', label: 'default' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(row)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/app/api/projects.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/projects/route'`

- [ ] **Step 3: Write the route**

```ts
// app/api/projects/route.ts
import { db } from '@/db'
import { projects, createProjectSchema } from '@/db/schema'
import { auth } from '@/lib/auth'
import { packageExists } from '@/lib/projects/packages'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const rows = await db.select().from(projects)
  return Response.json(rows)
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  if (!packageExists(parsed.data.label)) {
    return Response.json({ error: `No overlay package found for label "${parsed.data.label}"` }, { status: 400 })
  }

  const [row] = await db.insert(projects).values(parsed.data).returning()
  return Response.json(row, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/app/api/projects.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/route.ts test/app/api/projects.test.ts
git commit -m "feat(projects): GET/POST /api/projects route"
```

---

## Task 2: `GET /api/overlay-packages` route

**Files:**
- Create: `app/api/overlay-packages/route.ts`
- Test: `test/app/api/overlay-packages.test.ts`

**Interfaces:**
- Consumes: `listOverlayPackages` (`lib/projects/packages.ts`, already implemented — returns `Promise<OverlayPackageConfig[]>`), `auth`.
- Produces: `GET` handler returning `OverlayPackageConfig[]` (`{ label, name, thumbnailPath? }[]`) — consumed by Task 4's `store/apis/overlayPackagesApi.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// test/app/api/overlay-packages.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const { GET } = await import('@/app/api/overlay-packages/route')

describe('GET /api/overlay-packages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/x'))
    expect(res.status).toBe(401)
  })

  it('returns the default package (present on disk) with the expected shape', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await GET(new Request('http://localhost/x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'default', name: expect.any(String) }),
      ]),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/app/api/overlay-packages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

```ts
// app/api/overlay-packages/route.ts
import { auth } from '@/lib/auth'
import { listOverlayPackages } from '@/lib/projects/packages'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const packages = await listOverlayPackages()
  return Response.json(packages)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/app/api/overlay-packages.test.ts`
Expected: PASS (2 tests). This hits the real `listOverlayPackages()` (no mock) against the actual `projects/default/project.config.ts` on disk — confirms the route wiring works end-to-end, not just that the function is called.

- [ ] **Step 5: Commit**

```bash
git add app/api/overlay-packages/route.ts test/app/api/overlay-packages.test.ts
git commit -m "feat(projects): GET /api/overlay-packages route"
```

---

## Task 3: `store/apis/projectsApi.ts`

**Files:**
- Create: `store/apis/projectsApi.ts`
- Test: `test/store/apis/projectsApi.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at import time (hits `/api/projects` by URL string, same as every other `*Api.ts` in this codebase).
- Produces:
  ```ts
  export type Project = {
    id: string
    name: string
    mode: 'team_vs_team' | 'player_vs_player'
    label: string
    pictureUrl: string | null
    eventDate: string | null
    createdAt: string
    updatedAt: string
  }
  export const projectsApi: ReturnType<typeof createApi>
  export const useListProjectsQuery: () => { data?: Project[] }
  export const useCreateProjectMutation: () => [(data: CreateProjectInput) => Promise<unknown>, unknown]
  ```
  Consumed by Task 6 (`/admin` page) and Task 7 (`store/index.ts` wiring).

- [ ] **Step 1: Write the failing test**

```ts
// test/store/apis/projectsApi.test.ts
import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { projectsApi } from '@/store/apis/projectsApi'

describe('projectsApi', () => {
  it('exposes listProjects and createProject endpoints', () => {
    expect(Object.keys(projectsApi.endpoints)).toEqual(
      expect.arrayContaining(['listProjects', 'createProject']),
    )
  })

  it('registers its reducer under the configured store key', () => {
    const store = configureStore({
      reducer: { [projectsApi.reducerPath]: projectsApi.reducer },
      middleware: (gd) => gd().concat(projectsApi.middleware),
    })
    expect(store.getState()[projectsApi.reducerPath]).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store/apis/projectsApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// store/apis/projectsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Project = {
  id: string
  name: string
  mode: 'team_vs_team' | 'player_vs_player'
  label: string
  pictureUrl: string | null
  eventDate: string | null
  createdAt: string
  updatedAt: string
}

export type CreateProjectInput = {
  name: string
  mode: 'team_vs_team' | 'player_vs_player'
  label: string
  eventDate?: string
}

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Project'],
  endpoints: (b) => ({
    listProjects: b.query<Project[], void>({
      query: () => '/projects',
      providesTags: [{ type: 'Project', id: 'LIST' }],
    }),
    createProject: b.mutation<Project, CreateProjectInput>({
      query: (data) => ({ url: '/projects', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
    }),
  }),
})

export const { useListProjectsQuery, useCreateProjectMutation } = projectsApi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/store/apis/projectsApi.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add store/apis/projectsApi.ts test/store/apis/projectsApi.test.ts
git commit -m "feat(projects): projectsApi RTK Query slice"
```

---

## Task 4: `store/apis/overlayPackagesApi.ts`

**Files:**
- Create: `store/apis/overlayPackagesApi.ts`
- Test: `test/store/apis/overlayPackagesApi.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at import time.
- Produces:
  ```ts
  export type OverlayPackage = { label: string; name: string; thumbnailPath?: string }
  export const overlayPackagesApi: ReturnType<typeof createApi>
  export const useListOverlayPackagesQuery: () => { data?: OverlayPackage[] }
  ```
  Consumed by Task 6 (`/admin` page's Add Project dialog, for the label dropdown).

- [ ] **Step 1: Write the failing test**

```ts
// test/store/apis/overlayPackagesApi.test.ts
import { describe, it, expect } from 'vitest'
import { overlayPackagesApi } from '@/store/apis/overlayPackagesApi'

describe('overlayPackagesApi', () => {
  it('exposes a listOverlayPackages endpoint', () => {
    expect(Object.keys(overlayPackagesApi.endpoints)).toEqual(
      expect.arrayContaining(['listOverlayPackages']),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store/apis/overlayPackagesApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// store/apis/overlayPackagesApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type OverlayPackage = { label: string; name: string; thumbnailPath?: string }

export const overlayPackagesApi = createApi({
  reducerPath: 'overlayPackagesApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    listOverlayPackages: b.query<OverlayPackage[], void>({
      query: () => '/overlay-packages',
    }),
  }),
})

export const { useListOverlayPackagesQuery } = overlayPackagesApi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/store/apis/overlayPackagesApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add store/apis/overlayPackagesApi.ts test/store/apis/overlayPackagesApi.test.ts
git commit -m "feat(projects): overlayPackagesApi RTK Query slice"
```

---

## Task 5: Wire both new API slices into the store

**Files:**
- Modify: `store/index.ts`

**Interfaces:**
- Consumes: `projectsApi` (Task 3), `overlayPackagesApi` (Task 4).
- Produces: nothing new — extends the existing `RootState`/`store` already consumed everywhere else.

- [ ] **Step 1: Read the current `store/index.ts`**

The file currently builds `rootReducer` via `combineReducers` and a manual `entityMiddleware` array (this pattern was chosen deliberately in an earlier pass to work around a TypeScript instantiation-depth error when combining many RTK Query reducers inline — keep using it, don't revert to the plain object-literal `reducer: {...}` form).

- [ ] **Step 2: Add the two new imports and wire them into both `rootReducer` and `entityMiddleware`**

Add near the top with the other API imports:
```ts
import { projectsApi } from './apis/projectsApi'
import { overlayPackagesApi } from './apis/overlayPackagesApi'
```

Add to the `combineReducers({...})` call:
```ts
  [projectsApi.reducerPath]: projectsApi.reducer,
  [overlayPackagesApi.reducerPath]: overlayPackagesApi.reducer,
```

Add to the `entityMiddleware` array:
```ts
  projectsApi.middleware,
  overlayPackagesApi.middleware,
```

- [ ] **Step 3: Write a test asserting both are registered**

```ts
// test/store/store.test.ts — add this case to the existing file (read it first; keep the existing assertions intact)
import { projectsApi } from '@/store/apis/projectsApi'
import { overlayPackagesApi } from '@/store/apis/overlayPackagesApi'

// inside the existing describe('store', ...) block, add:
it('registers projectsApi and overlayPackagesApi reducers', () => {
  const state = store.getState()
  expect(state[projectsApi.reducerPath]).toBeDefined()
  expect(state[overlayPackagesApi.reducerPath]).toBeDefined()
})
```

- [ ] **Step 4: Run the store test**

Run: `npx vitest run test/store/store.test.ts`
Expected: PASS (all cases, including the new one)

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: all tests pass (the pre-existing unrelated `test/app/title-preview.test.tsx` failure, if still present in the working tree, is not part of this plan's scope).

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (If stale `.next/dev/types/validator.ts` errors appear referencing old page paths, run `rm -rf .next` first — this is a known stale-cache artifact, not a real error.)

- [ ] **Step 7: Commit**

```bash
git add store/index.ts test/store/store.test.ts
git commit -m "feat(projects): wire projectsApi and overlayPackagesApi into the store"
```

---

## Task 6: Rewrite `/admin` as the project gallery

**Files:**
- Modify: `app/admin/page.tsx` (currently a server component — becomes a client component)
- Keep: `app/admin/SignOutButton.tsx` (unchanged, reused as-is)

**Interfaces:**
- Consumes: `useListProjectsQuery`/`useCreateProjectMutation` (`store/apis/projectsApi.ts`, Task 3), `useListOverlayPackagesQuery` (`store/apis/overlayPackagesApi.ts`, Task 4), `Project`/`CreateProjectInput` types (Task 3), `SignOutButton` (existing, unchanged).
- Produces: nothing consumed by later tasks — this is the final integration point.

- [ ] **Step 1: Read the current `app/admin/page.tsx`**

It's a server component: checks the session server-side (`redirect('/login')` if none), renders "Admin", "Signed in as {email}", and `<SignOutButton />`. The session-guard behavior must be preserved — `proxy.ts` only checks cookie presence, this is the authoritative check.

- [ ] **Step 2: Write the new gallery page**

Session-checking on the server (keep this part as-is, in a server wrapper) plus a client component for the interactive gallery:

```tsx
// app/admin/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AdminGallery from './AdminGallery'

// proxy.ts only checks cookie presence; this is the authoritative check.
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return <AdminGallery userEmail={session.user.email} />
}
```

- [ ] **Step 3: Write the client gallery component**

```tsx
// app/admin/AdminGallery.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardActionArea, CardContent, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material'
import { useListProjectsQuery, useCreateProjectMutation } from '@/store/apis/projectsApi'
import { useListOverlayPackagesQuery } from '@/store/apis/overlayPackagesApi'
import SignOutButton from './SignOutButton'

export default function AdminGallery({ userEmail }: { userEmail: string }) {
  const { data: projects = [] } = useListProjectsQuery()
  const { data: packages = [] } = useListOverlayPackagesQuery()
  const [createProject] = useCreateProjectMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'team_vs_team' | 'player_vs_player'>('team_vs_team')
  const [label, setLabel] = useState('')
  const [eventDate, setEventDate] = useState('')

  function resetForm() {
    setName('')
    setMode('team_vs_team')
    setLabel('')
    setEventDate('')
  }

  async function handleCreate() {
    await createProject({
      name,
      mode,
      label,
      ...(eventDate ? { eventDate } : {}),
    })
    resetForm()
    setOpen(false)
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Projects</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2">{userEmail}</Typography>
          <SignOutButton />
        </Box>
      </Box>

      <Button variant="contained" onClick={() => setOpen(true)} sx={{ mb: 3 }}>
        Add Project
      </Button>

      {projects.length === 0 && (
        <Typography color="text.secondary">No projects yet — click Add Project to create one.</Typography>
      )}

      <Grid container spacing={2}>
        {projects.map((p) => (
          <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea component={Link} href={`/admin/${p.id}/data`}>
                <CardContent>
                  <Typography variant="h6">{p.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{p.mode}</Typography>
                  <Typography variant="body2" color="text.secondary">{p.label}</Typography>
                  {p.eventDate && <Typography variant="body2" color="text.secondary">{p.eventDate}</Typography>}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Project</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField
            select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'team_vs_team' | 'player_vs_player')}
          >
            <MenuItem value="team_vs_team">Team vs Team</MenuItem>
            <MenuItem value="player_vs_player">Player vs Player</MenuItem>
          </TextField>
          <TextField
            select
            label="Overlay Package"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          >
            {packages.map((pkg) => (
              <MenuItem key={pkg.label} value={pkg.label}>{pkg.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Event Date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name || !label}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
```

> `Grid` `size` prop syntax matches MUI v6's `Grid` component (`@mui/material` v6.5.0, per this project's `package.json`) — do not use the deprecated `item xs={...}` API from MUI v4/v5.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, no regressions. (No new component test for this page — consistent with the spec's decision to verify admin pages manually, matching how `/admin`, `/login`, and the Data CRUD pages are already handled in this codebase.)

- [ ] **Step 5: Run typecheck and lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: typecheck clean (after clearing stale `.next` if needed); lint exits 0 (warnings are acceptable, matching the rest of the codebase's baseline — fix any new errors).

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx app/admin/AdminGallery.tsx
git commit -m "feat(admin): project gallery with Add Project dialog"
```

---

## Task 7: Manual verification

**Files:** none — this task runs the app, no code changes.

**Interfaces:** N/A.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (plain `next dev` is sufficient — this feature touches no Netlify Blobs functionality)

- [ ] **Step 2: Ensure a user exists**

If no user exists yet in the dev database: `npx tsx scripts/create-user.ts you@example.com 'a-strong-password'`

- [ ] **Step 3: Sign in and verify the gallery**

Visit `http://localhost:3000/login`, sign in, land on `/admin`. Confirm:
- The existing seeded project ("Default Event" / `default` label) appears as a card.
- Clicking the card navigates to `/admin/00000000-0000-0000-0000-000000000001/data` and shows the existing Data hub.

- [ ] **Step 4: Create a second project through the dialog**

Click **Add Project**, fill in a name (e.g. "Second Event"), mode `team_vs_team`, overlay package `default` (only option available), no date. Submit. Confirm:
- The dialog closes and a new card appears in the gallery without a manual page reload (proves `createProject`'s tag invalidation triggers `listProjects` to refetch).
- Clicking the new card opens its own `/admin/<new-uuid>/data` — confirm the Players/Teams/etc. lists are empty there (proves `project_id` isolation holds for a freshly created project, not just the seeded one).

- [ ] **Step 5: Verify the 400 path**

With the browser dev tools network tab open (or via `curl` with a valid session cookie), attempt `POST /api/projects` with `label: "does-not-exist"`. Confirm a 400 response — this exercises the `packageExists` guard against a real request, not just the mocked unit test.

- [ ] **Step 6: Report results**

If any step fails, fix the underlying issue and re-run from Step 1. Once all steps pass, this plan is complete.

---

## Plan self-review notes

- **Spec coverage:** all 5 architecture sections from the design doc (`GET`/`POST /api/projects`, `GET /api/overlay-packages`, `projectsApi`, `overlayPackagesApi`, `/admin` page rewrite) map 1:1 to Tasks 1–6. The "Testing" section's manual-verification requirement (second project, isolation check) is Task 7. Out-of-scope items (`project_picture` upload, Overlays link, edit/delete, project-detail page) are correctly absent from every task.
- **Placeholder scan:** no TBD/TODO; every code step has literal code.
- **Type consistency:** `Project` type (Task 3) matches the `projects` table shape in `db/schema.ts` field-for-field (`id, name, mode, label, pictureUrl, eventDate, createdAt, updatedAt`). `CreateProjectInput` matches `createProjectSchema`'s shape (`name, mode, label, eventDate?` — `pictureUrl` intentionally omitted from the form per the picture-upload scope decision, though the schema itself still allows it via `.optional()`). `useListProjectsQuery`/`useCreateProjectMutation`/`useListOverlayPackagesQuery` names used in Task 6 match the exports defined in Tasks 3–4 exactly.
