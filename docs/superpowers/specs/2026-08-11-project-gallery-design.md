# Project Gallery + Creation UI — Design

**Date:** 2026-08-11
**Status:** Approved for planning

## Goal

Replace the `/admin` placeholder (session confirmation + sign-out button) with a real project gallery: list existing projects, create new ones via an "Add Project" dialog, and link into each project's Data workspace. This closes the gap identified after the data-entities work shipped — there was no way to create a second project, so all Data CRUD testing was pinned to the one seeded singleton project.

Full field-level spec: [docs/projects-system.md](../../projects-system.md) "Creating a project (operator)" section. `projects` table and `createProjectSchema` already exist in `db/schema.ts`. `packageExists`/`listOverlayPackageLabels`/`listOverlayPackages` already exist in `lib/projects/packages.ts`.

## Scope decisions (from brainstorming)

- **No `project_picture` upload in this pass.** The field stays in the schema/table (already present) with no UI. Uploading an image before a project exists (no `project_id` yet for the asset) is a real complication not worth solving for a nice-to-have field.
- **Gallery cards link straight to `/admin/[projectId]/data`.** No intermediate project-home page.
- **No "Overlays" link on cards.** `/admin/[projectId]/overlays` doesn't exist yet (rundowns/SSE are future work) — showing a dead or disabled link now is worse than adding it later when the page exists.
- **Not built on the generic `createCrudHandlers`/`<CrudPage>` framework.** That framework assumes `/api/projects/[projectId]/...` scoping; the projects collection itself sits above that hierarchy. This gets a small hand-written slice, the same way Brackets and Project CSS already deviate from the generic pattern for structural reasons.

## Architecture

### 1. Server: `GET` / `POST /api/projects`

`app/api/projects/route.ts`:
- `GET`: session-gated, returns all `projects` rows (unscoped — this is the one endpoint above the `project_id` hierarchy described in [docs/database.md](../../database.md)).
- `POST`: session-gated, parses body against `createProjectSchema` (400 on validation failure), calls `packageExists(body.label)` and returns 400 if the label doesn't match a real overlay-package folder, inserts the row, returns it with 201.

### 2. Server: `GET /api/overlay-packages`

`app/api/overlay-packages/route.ts`: thin wrapper around `listOverlayPackages()` (already implemented in `lib/projects/packages.ts`), session-gated. Feeds the label dropdown in the Add Project form so it isn't hardcoded and stays in sync with whatever folders exist under `projects/`.

### 3. Client: `store/apis/projectsApi.ts`

Hand-written RTK Query slice (not `createEntityApi` — no `projectId` parameter on these calls):
- `listProjects: query<Project[], void>`
- `createProject: mutation<Project, CreateProjectInput>`
- Tag type `'Project'`; `createProject` invalidates the list tag.

### 4. Client: `store/apis/overlayPackagesApi.ts`

Small RTK Query slice: `listOverlayPackages: query<OverlayPackageConfig[], void>`, no mutations.

### 5. `/admin` page rewrite

`app/admin/page.tsx` (currently a server component with a client `SignOutButton`) becomes a client page:
- Header: "Projects" title, sign-out button (kept), "Add Project" button.
- Grid/list of project cards: name, mode, label, event date (if set). Each card links to `/admin/[projectId]/data`.
- Empty state: "No projects yet" message when the list is empty.
- "Add Project" opens an MUI `Dialog` (same visual pattern as `<CrudPage>`'s create dialog, but hand-written — this form has no entity-def to drive it):
  - Name — text, required
  - Mode — select, `team_vs_team` / `player_vs_player`, required
  - Label — select, populated from `useListOverlayPackagesQuery`, required
  - Event date — optional date picker
  - Submit calls `createProject`; on success, close dialog, list re-renders via cache invalidation.

The session check (`redirect('/login')` if unauthenticated) stays — it's the authoritative guard `proxy.ts` doesn't replace.

## Testing

- `test/app/api/projects.test.ts`: `GET` returns 401 without session; `POST` returns 400 on missing/invalid fields; `POST` returns 400 when `label` doesn't match a real package; `POST` returns 201 and the inserted row on success. Same mocking pattern as `test/lib/crud/createCrudHandlers.test.ts`.
- `test/app/api/overlay-packages.test.ts`: returns the `default` package (already on disk) with the expected shape.
- No component test for the gallery page itself — consistent with how `/admin`, `/login`, and the other admin pages in this codebase are verified manually rather than unit-tested. Verified manually via `npm run dev` (or `netlify dev`) at the end: create a second project through the dialog, confirm it appears in the gallery, confirm its card links to a working Data hub with its own empty Players/Teams/etc. lists (proving `project_id` isolation holds for a real second project, not just the seeded one).

## Out of scope for this pass

- `project_picture` upload
- `/admin/[projectId]/overlays` link/page (rundowns/SSE system)
- Editing or deleting an existing project
- Project-level detail/home page between the gallery and Data hub
