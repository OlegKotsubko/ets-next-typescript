# Folder-driven titles + tournament CRUD — Design

**Date:** 2026-08-18
**Status:** approved (brainstorming) → ready for writing-plans

## Goal

Replace the DB-stored "labels/disciplines" mechanism for overlay availability with a
**folder-driven** one, and make tournaments **authored in the UI (full CRUD)**.

- Overlay availability for a tournament is decided by a set of **packs** it references.
- A **pack** is a top-level folder under `overlays/` (one level of nesting); the folder
  name is the overlay's `category` and the pack name.
- A tournament stores **`overlayPacks: text[]`** — plain folder-name strings, many per
  tournament. The rundown editor shows titles whose `category ∈ overlayPacks`.
- The `tags` (disciplines) table and all `disciplineId` columns are **removed**.
- There is **no `general` fallback** — an empty `overlayPacks` means zero available titles.
- The available pack names for the tournament form come from the **catalog**
  (`listCategories()`), which the `titles:generate` codegen already derives from the folders.

## Decisions (locked in brainstorming)

1. **Tournament ↔ pack:** many packs per tournament, stored as `projects.overlayPacks text[]`
   of folder-name strings. No labels/tags join table.
2. **Tags/disciplines:** removed entirely — drop the `tags` table, the `project_tags` join,
   and `disciplineId` from `projects`, `players`, `teams`. Nothing is classified by discipline.
3. **Tournament fields:** `title`, `status`, `overlayPacks[]` (plus integer `id`, timestamps,
   and the existing `project_favourites` relation). **No** `heroSection`/hero image, **no** discipline.
4. **No `general` special-case** in availability.
5. **Pack list source:** derived from the catalog (`listCategories()`), not a DB table and not a
   runtime filesystem scan.
6. Breaking schema change is acceptable; the user clears seed/mock data separately.

## Data model

### `projects` (edit)
- **Add:** `overlayPacks: text('overlay_packs').array().notNull().default(sql\`'{}'::text[]\`)`.
- **Remove:** `disciplineId`, `heroSectionUrl`.
- **Keep:** `id`, `title`, `status` (enum `draft|upcoming|ongoing|ended`), `createdAt`, `updatedAt`.
- `project_favourites` unchanged.

### Remove tables
- `tags`
- `project_tags`

### `players` / `teams` (edit)
- Remove `disciplineId` column and its FK.

### Migration
- `db:generate` emits `0004_*.sql` (drop `tags` + `project_tags`, drop the three `discipline_id`
  columns + `hero_section_url`, add `projects.overlay_packs`). **Not** applied by us — user runs
  `db:migrate`.

## Overlay availability

### `lib/overlays/catalog.ts`
- Add `listCategories(): string[]` — distinct `category` values across catalog entries, sorted.
- Change `listOverlays(packs: string[]): CatalogEntry[]` → returns entries where
  `packs.includes(e.category)`. **Drop** the `e.category === 'general'` clause.
  (Empty `packs` ⇒ empty list.)
- Update **all** `listOverlays` callers to the new array signature (the rundown editor; the
  `app/dev/overlays` harness if it calls it — the harness may instead use a "show everything"
  path, e.g. `listCategories()` fed back in, since it has no tournament context).

### Rundown editor (`app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`)
- Remove the `useListTagsQuery` + `disciplineId → name` lookup.
- `const catalog = listOverlays(project?.overlayPacks ?? [])`.

## Tournament CRUD

### Zod (`db/schemas/projects.ts`)
```ts
export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(['draft', 'upcoming', 'ongoing', 'ended']).default('draft'),
  overlayPacks: z.array(z.string()).default([]),
})
export const updateProjectSchema = createProjectSchema.partial()
```

### API (projects are GLOBAL — not `project_id`-scoped)
- `GET /api/projects` — list (exists).
- `POST /api/projects` — create `{ title, status, overlayPacks }`.
- `GET /api/projects/[projectId]` — one (exists).
- `PATCH /api/projects/[projectId]` — edit.
- `DELETE /api/projects/[projectId]` — delete (cascades to rundowns/entities via existing FKs).
- All auth-gated by session (not the `/api/projects/*` project-scope proxy rule, which still applies).

### RTK (`store/apis/projectsApi.ts`)
- Add `createProject`, `updateProject`, `deleteProject` mutations; invalidate the projects list tag.

### UI (`/projects` gallery)
- **Add tournament** button → create form (dialog).
- Per-card **edit** / **delete** controls.
- Form fields: `title` (text), `status` (select), `overlayPacks` (multi-select whose options are
  `listCategories()`).

## Fallout cleanup

Delete:
- `store/apis/tagsApi.ts`, `app/api/tags/route.ts`, `app/api/tags/[id]/route.ts`,
  `app/(admin)/projects/[projectId]/data/tags/page.tsx`, and any tags test(s).
- The **Tags** entry in the Data-section nav.

Adjust:
- `players` + `teams`: remove the discipline field from `db/schemas/*`, `lib/entities/*`, and the
  form select on their Data pages.
- `lib/entities/types.ts`: drop `disciplineId` from shared shapes.
- `store/index.ts`: drop `tagsApi` reducer + middleware.
- `app/(admin)/projects/ProjectsGallery.tsx`: remove any discipline display/filter; add the CRUD.
- `scripts/seed-dev.ts`: remove tags/discipline/hero references so `tsc` stays green (the user
  clears the actual seed rows).

## Verification

- `npm run db:generate` produces `0004`; **do not** run `db:migrate`.
- `npm run typecheck` clean, `npm run lint` 0 errors, `npm test` green (update/remove tags &
  discipline tests; add project-CRUD + `listOverlays(packs)` / `listCategories()` tests).
- `npm run build` OK; `next dev` route tree clean.
- Browser: create a tournament with packs → rundown editor shows only pack-matched titles; empty
  packs ⇒ no titles; edit/delete a tournament works.

## Docs to update (after code)

`CLAUDE.md` + `AGENTS.md` (decision 1), `docs/projects-system.md` (packs replace discipline;
"which overlays a tournament can use"), `docs/database.md` (drop tags/disciplines, add
`overlay_packs`), `docs/data-entities.md` (players/teams lose discipline), `docs/architecture.md`
(tournament CRUD exists; nav loses Tags).

## Out of scope

- Overlay-pack authoring UI (packs are folders created by developers, as today).
- Any change to broadcast addressing, the controller, or overlay internals.
