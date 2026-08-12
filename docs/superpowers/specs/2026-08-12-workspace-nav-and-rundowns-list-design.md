# Workspace Nav + Rundowns List/Create — Design

**Date:** 2026-08-12
**Status:** Approved for planning

## Goal

Give each project a persistent workspace header (**Data** / **Rundowns** / **Midi**) and stand up the first slice of the rundown system: list existing rundowns, create new ones, and navigate into a stub per-rundown page. This is the foundation the rundown editor (titles picker, HIDE/AIR controller) and the broadcast bus (SSE, `/preview`, `/air`) will build on in a later pass — both are explicitly out of scope here.

Full rundown data-model and controller spec: [docs/rundowns.md](../../rundowns.md). Full broadcast contract: [docs/preview-air.md](../../preview-air.md). Neither is touched by this pass beyond reusing the already-migrated `rundowns` table.

## Naming: deviation from current docs

`docs/rundowns.md` and `CLAUDE.md`'s route map document a deliberate rename: the operator-facing nav says **"Overlays"** at `/admin/[projectId]/overlays`, replacing an older "Rundowns" tab (the DB tables keep the `rundowns`/`rundown_items` names either way). This spec intentionally uses **"Rundowns"** as both the nav label and the route (`/admin/[projectId]/rundowns`), per explicit direction during brainstorming. This is a conscious divergence from the current docs, not an oversight — noted here so a future reader doesn't "fix" it back without checking.

"Midi" is a disabled, non-navigating placeholder link — MIDI control surfaces are out of MVP scope per [docs/roadmap.md](../../roadmap.md).

## Architecture

### 1. Shared workspace layout

`app/admin/[projectId]/layout.tsx` (new): a server component wrapping every `/admin/[projectId]/*` page.

- Session-gated the same way `/admin` and `/admin/[projectId]/data` already are (`auth.api.getSession`, `redirect('/login')` if absent) — this layout becomes the authoritative guard for the whole workspace subtree; existing per-page checks in `data/page.tsx` may be removed if this makes them redundant (confirm during implementation — don't duplicate the check if the layout already covers it).
- Fetches the project by `projectId` (404 / not-found UI if missing) to show its name in the header.
- Renders a header: project name, then three links — **Data** (`/admin/[projectId]/data`), **Rundowns** (`/admin/[projectId]/rundowns`), **Midi** (rendered as disabled text, not a link — no `href`, styled muted, `aria-disabled="true"`).
- Active-link highlighting: a small client component (`WorkspaceNav.tsx`) using `usePathname()` to compare against each link's `href` prefix and apply an active style (MUI `Tabs`/`Tab` with `component={Link}`, or manually with `ListItemButton selected={...}` — implementer's choice, matching existing MUI usage patterns in `AdminGallery.tsx`).
- `{children}` renders below the header.

### 2. Rundowns list + create

`app/admin/[projectId]/rundowns/page.tsx` (new, client component) — structurally mirrors `app/admin/AdminGallery.tsx`:

- `useListRundownsQuery(projectId)` → grid/list of cards: rundown name, created date. Empty state: "No rundowns yet."
- "Add Rundown" button opens an MUI `Dialog` with a single required `name` TextField.
- Submit calls `useCreateRundownMutation()` with `{ projectId, data: { name } }`; same `.unwrap()` + try/catch + `getErrorMessage` error-surfacing pattern as `AdminGallery.tsx`'s `handleCreate`, same double-submit guard (`disabled={!name.trim() || isLoading}`).
- On success: close dialog, reset the `name` field, list re-renders via RTK Query cache invalidation (already wired by `createEntityApi`'s `invalidatesTags`).
- `isError` from `useListRundownsQuery` renders an MUI `Alert` (same pattern as `AdminGallery.tsx`'s project/package list errors).
- Each card links to `/admin/[projectId]/rundowns/[rundownId]`.

### 3. Rundown stub page

`app/admin/[projectId]/rundowns/[rundownId]/page.tsx` (new, client component):

- `useGetRundownQuery({ projectId, id: rundownId })`.
- Renders the rundown's name as a heading, "0 items" as static placeholder text (no `rundown_items` UI yet), and a "← Back to Rundowns" link to `/admin/[projectId]/rundowns`.
- Not-found state (404 from the API, e.g. wrong project or bad id): "Rundown not found" message + back link.

## Data model & API

No migration — `rundowns` already exists in `db/schema.ts`:

```ts
export const rundowns = pgTable('rundowns', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('rundowns_project_idx').on(t.projectId)])
```

`ownerId` stays unset (`null`) on create in this pass — no session-user wiring yet. That's a one-line addition later, not a schema change.

### `db/schemas/rundowns.ts` (new)

```ts
import { z } from 'zod'

export const createRundownSchema = z.object({
  name: z.string().min(1).max(120),
})
export const updateRundownSchema = createRundownSchema.partial()
export type CreateRundownInput = z.infer<typeof createRundownSchema>
export type UpdateRundownInput = z.infer<typeof updateRundownSchema>
```

### `app/api/projects/[projectId]/rundowns/route.ts` (new)

```ts
import { rundowns } from '@/db/schema'
import { createRundownSchema, updateRundownSchema } from '@/db/schemas/rundowns'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: rundowns, createSchema: createRundownSchema, updateSchema: updateRundownSchema })
```

Same one-line pattern as `app/api/projects/[projectId]/players/route.ts`. `GET` returns all rundowns for `projectId` (session-gated, 401 without session). `POST` validates `{ name }` (400 on empty/missing), inserts with `projectId` from the URL, returns 201 + the row.

### `app/api/projects/[projectId]/rundowns/[id]/route.ts` (new)

```ts
import { rundowns } from '@/db/schema'
import { createRundownSchema, updateRundownSchema } from '@/db/schemas/rundowns'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET } = createCrudHandlers({ table: rundowns, createSchema: createRundownSchema, updateSchema: updateRundownSchema })
```

Only `GET` is exported (single row, scoped to `projectId` + `id`, 404 if not found) — used by the stub page. `PATCH`/`DELETE` exist on the factory's return value but aren't exported; rename/delete are out of scope this pass.

## Client state

### `lib/entities/rundowns.ts` (new)

```ts
export type Rundown = {
  id: string
  projectId: string
  name: string
  ownerId: string | null
  createdAt: string
  updatedAt: string
}
```

No `EntityDef` — the gallery/stub UI is hand-written (like `AdminGallery.tsx`), not driven through the generic `<CrudPage>` framework.

### `store/apis/rundownsApi.ts` (new)

```ts
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

Same shape as `store/apis/playersApi.ts`, omitting the update/delete hook exports since those routes aren't wired up.

### `store/index.ts` changes

Add `rundownsApi` to the `combineReducers` object and `entityMiddleware` array — the same two-line addition every prior entity slice has made.

## Testing

- `test/app/api/rundowns.test.ts`: `GET` 401 without session; `POST` 400 on missing/empty `name`; `POST` 201 + inserted row (with `projectId` from the URL, not the body) on success; `GET` list scoped to `projectId` (a rundown belonging to a different project doesn't appear). Same mocking pattern as `test/app/api/projects.test.ts` / existing entity route tests.
- No component tests for the layout, gallery, or stub pages — consistent with how `/admin`, `/login`, and the Data hub are verified manually in this codebase.
- Manual verification pass at the end (`npm run dev` or `netlify dev`):
  1. Open an existing project's `/admin/[projectId]/data` — confirm the new header shows Data (active/highlighted), Rundowns, and a visibly disabled Midi.
  2. Click Rundowns — confirm navigation to `/admin/[projectId]/rundowns`, header updates to show Rundowns as active, empty state renders (assuming no rundowns yet for this project).
  3. Create a rundown via the dialog — confirm it appears in the list without a manual refresh.
  4. Click the new rundown's card — confirm navigation to the stub page showing its name and "0 items", with a working back link.
  5. Attempt to click Midi — confirm nothing happens (no navigation, no console error).
  6. Directly visit a rundown id that doesn't exist (or belongs to another project) — confirm the "Rundown not found" state renders instead of a crash.

## Out of scope for this pass

- The rundown editor (titles picker, settings form, HIDE/AIR controller) — `docs/rundowns.md` "The rundown editor" section, future spec.
- The broadcast bus, SSE endpoint, `/preview` and `/air` pages — `docs/preview-air.md`, future spec.
- Rundown rename/delete (routes exist on the CRUD factory but aren't wired to the UI or exported from the route file).
- `ownerId` population from the session user.
- Any MIDI functionality — the nav link is a disabled placeholder only.
