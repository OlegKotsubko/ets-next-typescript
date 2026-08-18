# Folder-driven titles + tournament CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decide a tournament's available titles by folder-derived **packs** (`projects.overlayPacks text[]`), make tournaments fully CRUD-able in the UI, and remove the `tags`/disciplines model entirely.

**Architecture:** A pack = a top-level `overlays/` folder = an overlay's `category`. The catalog (already generated from the folder scan) exposes the pack list. Tournaments store a `text[]` of pack names; the rundown editor filters titles by `category ∈ overlayPacks`. Tournaments gain POST/PATCH/DELETE. `tags`, `project_tags`, and all `disciplineId` columns are dropped.

**Tech Stack:** Next.js 16 App Router · Drizzle + Neon · Zod · RTK Query · MUI · Vitest.

## Global Constraints

- **Never run `db:migrate`** — generate the migration only; the user applies it.
- **Never touch `.env`.**
- Tests mock `@/db` and `@/lib/auth` (see existing `test/app/api/*`); no live DB in tests.
- `projects` are **global** (not `project_id`-scoped); their routes are `/api/projects` and `/api/projects/[projectId]`, auth-gated by session.
- `overlayPacks` values are plain folder-name strings; the option list is `listCategories()` from `@/lib/overlays/catalog`.
- **No `general` fallback** — availability is exactly `category ∈ overlayPacks`.
- Keep each task green: `npm run typecheck`, `npm run lint` (0 errors), `npm test`.

---

### Task 1: Packs foundation — schema field, catalog API, editor switch

**Files:**
- Modify: `db/schema.ts` (add `projects.overlayPacks`, additive only)
- Modify: `store/apis/projectsApi.ts` (add `overlayPacks` to `Project` type)
- Modify: `lib/overlays/catalog.ts` (`listCategories`, `listOverlays(packs)`)
- Modify: `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx` (use `overlayPacks`)
- Modify: `app/dev/overlays/*` (whatever calls `listOverlays` — feed `listCategories()`)
- Test: `test/lib/overlays-catalog.test.ts` (new)

**Interfaces:**
- Produces: `listCategories(): string[]`, `listOverlays(packs: string[]): CatalogEntry[]`, `Project.overlayPacks: string[]`.

- [ ] **Step 1: Write failing catalog tests**

```ts
// test/lib/overlays-catalog.test.ts
import { describe, it, expect } from 'vitest'
import { listCategories, listOverlays } from '@/lib/overlays/catalog'

describe('catalog packs API', () => {
  it('listCategories returns distinct sorted categories', () => {
    const cats = listCategories()
    expect(cats).toContain('general')
    expect([...cats]).toEqual([...cats].sort())
    expect(new Set(cats).size).toBe(cats.length)
  })
  it('listOverlays returns only overlays whose category is in the pack list', () => {
    const res = listOverlays(['general'])
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((e) => e.category === 'general')).toBe(true)
  })
  it('empty packs => empty list (no general fallback)', () => {
    expect(listOverlays([])).toEqual([])
  })
  it('unknown pack => empty', () => {
    expect(listOverlays(['does-not-exist'])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it, expect FAIL** — `npx vitest run test/lib/overlays-catalog.test.ts` (types: `listCategories` missing / signature mismatch).

- [ ] **Step 3: Update the catalog**

In `lib/overlays/catalog.ts` replace `listOverlays` and add `listCategories`:

```ts
export function listOverlays(packs: string[]): CatalogEntry[] {
  return entries.filter((e) => packs.includes(e.category))
}
export function listCategories(): string[] {
  return Array.from(new Set(entries.map((e) => e.category))).sort()
}
```

- [ ] **Step 4: Add `projects.overlayPacks` (additive)**

In `db/schema.ts`, in the `projects` table (keep `disciplineId`/`heroSectionUrl` for now):

```ts
overlayPacks: text('overlay_packs').array().notNull().default(sql`'{}'::text[]`),
```
(`sql` is already imported.)

- [ ] **Step 5: Add `overlayPacks` to the `Project` type**

In `store/apis/projectsApi.ts`, add to `Project`:

```ts
overlayPacks: string[]
```

- [ ] **Step 6: Switch the rundown editor to packs**

In `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`: remove `useListTagsQuery`, the `tags` var, and the `disciplineName` lookup. Replace:

```ts
const catalog = listOverlays(project?.overlayPacks ?? [])
```

- [ ] **Step 7: Fix the dev harness caller**

In `app/dev/overlays/page.tsx` (or wherever it calls `listOverlays`), pass `listCategories()` so the harness shows every pack:

```ts
const catalog = listOverlays(listCategories())
```

- [ ] **Step 8: Green** — `npx vitest run test/lib/overlays-catalog.test.ts` PASS; `npm run typecheck`; `npm run lint`.

- [ ] **Step 9: Commit** — `feat(overlays): folder-pack availability (listCategories + listOverlays(packs))`

---

### Task 2: Tournament CRUD API

**Files:**
- Modify: `db/schemas/projects.ts` (create/update Zod)
- Modify: `app/api/projects/route.ts` (add `POST`)
- Modify: `app/api/projects/[projectId]/route.ts` (add `PATCH`, `DELETE`)
- Test: `test/app/api/projects-crud.test.ts` (new)

**Interfaces:**
- Consumes: `overlayPacks` column (Task 1).
- Produces: `createProjectSchema`, `updateProjectSchema`; `POST /api/projects`, `PATCH`/`DELETE /api/projects/[projectId]`.

- [ ] **Step 1: Add Zod schemas**

Append to `db/schemas/projects.ts`:

```ts
export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  status: projectStatus.default('draft'),
  overlayPacks: z.array(z.string()).default([]),
})
export const updateProjectSchema = createProjectSchema.partial()
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
```

- [ ] **Step 2: Write failing route tests**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
const list = await import('@/app/api/projects/route')
const one = await import('@/app/api/projects/[projectId]/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(o) })

describe('project CRUD', () => {
  beforeEach(() => { vi.clearAllMocks(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('POST creates a tournament', async () => {
    dbMock.insert.mockReturnValue({ values: () => ({ returning: () => Promise.resolve([{ id: 1, title: 'T', status: 'draft', overlayPacks: ['MRI'] }]) }) })
    const res = await list.POST(body({ title: 'T', overlayPacks: ['MRI'] }))
    expect(res.status).toBe(201)
  })
  it('POST rejects empty title', async () => {
    const res = await list.POST(body({ title: '' }))
    expect(res.status).toBe(400)
  })
  it('PATCH updates', async () => {
    dbMock.update.mockReturnValue({ set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: 1, title: 'X', status: 'draft', overlayPacks: [] }]) }) }) })
    const res = await one.PATCH(body({ title: 'X' }), P({ projectId: '1' }))
    expect(res.status).toBe(200)
  })
  it('DELETE removes', async () => {
    dbMock.delete.mockReturnValue({ where: () => Promise.resolve() })
    const res = await one.DELETE(new Request('http://x', { method: 'DELETE' }), P({ projectId: '1' }))
    expect(res.status).toBe(200)
  })
  it('401 without session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await list.POST(body({ title: 'T' }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run it, expect FAIL** (`POST`/`PATCH`/`DELETE` not exported).

- [ ] **Step 4: Add `POST` to `app/api/projects/route.ts`**

```ts
import { createProjectSchema } from '@/db/schemas/projects'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const parsed = createProjectSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(projects).values(parsed.data).returning()
  return Response.json(row, { status: 201 })
}
```
(Update the file's top comment that says "there is no POST".)

- [ ] **Step 5: Add `PATCH` + `DELETE` to `app/api/projects/[projectId]/route.ts`**

```ts
import { updateProjectSchema } from '@/db/schemas/projects'

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const parsed = updateProjectSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.update(projects).set(parsed.data)
    .where(eq(projects.id, Number(projectId))).returning()
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  await db.delete(projects).where(eq(projects.id, Number(projectId)))
  return new Response(null, { status: 200 })
}
```

- [ ] **Step 6: Green** — the new test file PASS; `npm run typecheck`; `npm run lint`.

- [ ] **Step 7: Commit** — `feat(api): tournament create/update/delete`

---

### Task 3: projectsApi CRUD mutations

**Files:**
- Modify: `store/apis/projectsApi.ts`

**Interfaces:**
- Produces: `useCreateProjectMutation`, `useUpdateProjectMutation`, `useDeleteProjectMutation`.

- [ ] **Step 1: Add mutations** to `projectsApi` `endpoints`:

```ts
createProject: b.mutation<Project, { title: string; status?: string; overlayPacks?: string[] }>({
  query: (data) => ({ url: '/projects', method: 'POST', body: data }),
  invalidatesTags: [{ type: 'Project', id: 'LIST' }],
}),
updateProject: b.mutation<Project, { projectId: number; data: Partial<{ title: string; status: string; overlayPacks: string[] }> }>({
  query: ({ projectId, data }) => ({ url: `/projects/${projectId}`, method: 'PATCH', body: data }),
  invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Project', id: 'LIST' }, { type: 'Project', id: String(projectId) }],
}),
deleteProject: b.mutation<void, { projectId: number }>({
  query: ({ projectId }) => ({ url: `/projects/${projectId}`, method: 'DELETE' }),
  invalidatesTags: [{ type: 'Project', id: 'LIST' }],
}),
```

- [ ] **Step 2: Export the hooks** in the destructure at the bottom.

- [ ] **Step 3: Green** — `npm run typecheck`; `npm run lint`.

- [ ] **Step 4: Commit** — `feat(store): project create/update/delete mutations`

---

### Task 4: Gallery CRUD UI

**Files:**
- Modify: `app/(admin)/projects/ProjectsGallery.tsx`
- Create: `components/admin/projects/TournamentFormDialog.tsx`

**Interfaces:**
- Consumes: `useCreateProjectMutation`/`useUpdateProjectMutation`/`useDeleteProjectMutation` (Task 3), `listCategories()` (Task 1).

- [ ] **Step 1: Build the form dialog** — `TournamentFormDialog.tsx`: MUI `Dialog` with `title` (TextField), `status` (Select of the four statuses), and `overlayPacks` (multi-`Select` whose `MenuItem`s come from `listCategories()`, rendered with checkboxes). Props: `{ open, initial?: {id,title,status,overlayPacks}, onClose, onSubmit(data) }`. On submit calls `onSubmit` with `{ title, status, overlayPacks }`.

```tsx
'use client'
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Checkbox, ListItemText, Select, InputLabel, FormControl,
} from '@mui/material'
import { listCategories } from '@/lib/overlays/catalog'

const STATUSES = ['draft', 'upcoming', 'ongoing', 'ended'] as const

export function TournamentFormDialog({
  open, initial, onClose, onSubmit,
}: {
  open: boolean
  initial?: { title: string; status: string; overlayPacks: string[] }
  onClose: () => void
  onSubmit: (d: { title: string; status: string; overlayPacks: string[] }) => void
}) {
  const packs = listCategories()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'draft')
  const [selected, setSelected] = useState<string[]>(initial?.overlayPacks ?? [])
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{initial ? 'Edit tournament' : 'New tournament'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <FormControl>
          <InputLabel>Overlay packs</InputLabel>
          <Select multiple value={selected} label="Overlay packs"
            onChange={(e) => setSelected(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            renderValue={(v) => (v as string[]).join(', ')}>
            {packs.map((p) => (
              <MenuItem key={p} value={p}>
                <Checkbox checked={selected.includes(p)} />
                <ListItemText primary={p} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!title.trim()}
          onClick={() => onSubmit({ title: title.trim(), status, overlayPacks: selected })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire the gallery** — In `ProjectsGallery.tsx`: add an **Add tournament** button that opens the dialog in create mode (`createProject`), per-card **Edit** (opens dialog with `initial`, `updateProject`) and **Delete** (`deleteProject`, with a confirm). Remove any discipline display. Keep favourites + status filter.

- [ ] **Step 3: Verify in browser** — `preview_start` → `/projects`: create a tournament (pick packs), edit it, delete it; confirm the list refreshes. (Requires the migration; if the column is missing the API 500s — that is the user's `db:migrate` step, note it but don't block.)

- [ ] **Step 4: Green** — `npm run typecheck`; `npm run lint`.

- [ ] **Step 5: Commit** — `feat(projects): tournament CRUD gallery (add/edit/delete + pack multi-select)`

---

### Task 5: Purge tags + disciplines

**Files:**
- Modify: `db/schema.ts` (remove `tags`, `projectTags`, `projects.disciplineId`, `projects.heroSectionUrl`, `players.disciplineId`, `teams.disciplineId`)
- Modify: `store/apis/projectsApi.ts` (drop `heroSectionUrl`, `disciplineId` from `Project`)
- Delete: `store/apis/tagsApi.ts`, `app/api/tags/route.ts`, `app/api/tags/[id]/route.ts`, `app/(admin)/projects/[projectId]/data/tags/page.tsx`
- Modify: `store/index.ts` (drop `tagsApi`)
- Modify: `db/schemas/players.ts`, `db/schemas/teams.ts`, `lib/entities/players.ts`, `lib/entities/teams.ts`, `lib/entities/types.ts`
- Modify: players + teams Data pages (drop the discipline `Select` + `useListTagsQuery`)
- Modify: the Data-section nav (remove **Tags**)
- Modify: `app/(admin)/projects/ProjectsGallery.tsx` (any remaining discipline refs)
- Modify: `scripts/seed-dev.ts` (strip tags/discipline/hero)
- Delete/modify: tags + discipline tests

- [ ] **Step 1: Find the blast radius** — `grep -rlE "tagsApi|disciplineId|heroSectionUrl|useListTagsQuery|/api/tags|projectTags|\\btags\\b" app store components db lib scripts test` and list every hit. (Known set is in the Files list; confirm nothing new.)

- [ ] **Step 2: Delete the tags surface** — remove the four files above; drop `tagsApi` from `store/index.ts` (reducer + middleware); remove the **Tags** nav entry.

- [ ] **Step 3: Remove discipline from players/teams** — delete `disciplineId` from `db/schemas/players.ts` + `teams.ts`, from `lib/entities/players.ts` + `teams.ts` + `types.ts`, and delete the discipline `Select` + `useListTagsQuery` usage from both Data pages.

- [ ] **Step 4: Remove columns/tables from `db/schema.ts`** — delete the `tags` and `projectTags` table exports; delete `disciplineId` from `projects`/`players`/`teams`; delete `projects.heroSectionUrl`.

- [ ] **Step 5: Update `Project` type** — remove `heroSectionUrl` and `disciplineId` in `store/apis/projectsApi.ts`.

- [ ] **Step 6: Fix the seed script** — in `scripts/seed-dev.ts` remove tag inserts and any `disciplineId`/`heroSectionUrl` fields; add `overlayPacks` where a project is seeded (e.g. `['general']`) if the script stays.

- [ ] **Step 7: Delete/repair tests** — remove `test/**` files that target tags CRUD or assert `disciplineId`; adjust player/team tests that pass `disciplineId`.

- [ ] **Step 8: Green** — `npm run typecheck`; `npm run lint`; `npm test`.

- [ ] **Step 9: Commit** — `refactor(schema): remove tags/disciplines; tournaments use overlay packs`

---

### Task 6: Migration + whole-project green gate + browser smoke

**Files:**
- Create: `db/migrations/0004_*.sql` (generated)

- [ ] **Step 1: Generate the migration** — `npm run db:generate`. Expect: drop `tags`, `project_tags`; drop `projects.discipline_id`, `projects.hero_section_url`, `players.discipline_id`, `teams.discipline_id`; add `projects.overlay_packs`.

- [ ] **Step 2: Eyeball the SQL** — open `db/migrations/0004_*.sql` and confirm only those statements. **Do not** run `db:migrate`.

- [ ] **Step 3: Full gate** — `npm run typecheck` clean; `npm run lint` 0 errors; `npm test` green; `npm run build` OK.

- [ ] **Step 4: Route-tree check** — `preview_start`; confirm no compile errors in `preview_logs`; `/projects` and `/dev/overlays` compile.

- [ ] **Step 5: Commit** — `chore(db): migration 0004 (overlay_packs; drop tags/disciplines)`

---

### Task 7: Docs

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md` (decision 1), `docs/projects-system.md`, `docs/database.md`, `docs/data-entities.md`, `docs/architecture.md`

- [ ] **Step 1: Update the "which overlays a tournament can use" story** — decision 1 in `CLAUDE.md` + `AGENTS.md`: overlays are organized by pack (top-level `overlays/` folder = category); a tournament's `overlayPacks[]` selects packs; no discipline, no `general` fallback.
- [ ] **Step 2: `docs/database.md`** — drop the tags/disciplines section; add `projects.overlayPacks`; remove `disciplineId` from players/teams; note tournament CRUD.
- [ ] **Step 3: `docs/projects-system.md`** — packs replace discipline; the pack list is folder-derived (`listCategories()`).
- [ ] **Step 4: `docs/data-entities.md`** — players/teams lose the discipline field.
- [ ] **Step 5: `docs/architecture.md`** — tournaments are now created in-app (CRUD); Data nav loses **Tags**.
- [ ] **Step 6: Commit** — `docs: folder-pack titles + tournament CRUD`

---

## Self-review notes

- **Spec coverage:** schema (T1,T5), catalog (T1), CRUD API (T2), RTK (T3), UI (T4), purge (T5), migration (T6), docs (T7) — all covered.
- **Type consistency:** `Project.overlayPacks: string[]` added in T1, discipline/hero removed in T5; `createProjectSchema`/`updateProjectSchema` used by both routes (T2) and mutations (T3).
- **Ordering:** additive first (T1–T4 keep tags alive so nothing breaks), destructive purge last but one (T5), migration generated once after all schema edits (T6).
