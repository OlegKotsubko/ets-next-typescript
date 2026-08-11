# Data Entities CRUD — Design

**Date:** 2026-08-11
**Branch:** `p3-data-entities`
**Status:** Approved for planning

## Goal

Build the full **Data** section of the admin: 8 entity types (Assets, Players, Talents, Teams, Sponsors, Tournament Brackets, Project CSS, Project Videos), each backed by a Postgres table, a Zod schema, REST routes under `/api/projects/[projectId]/<entity>`, and an admin UI page. This is the first CRUD layer in the app and establishes the pattern the rest of the data entities (and later, rundowns) will reuse.

Full field-level spec for every entity: [docs/data-entities.md](../../data-entities.md). Multi-tenancy rules: [docs/database.md](../../database.md). This design covers *how* we build it, not *what* the fields are — defer to those docs for field lists and stick to this doc for architecture/sequencing decisions.

## Scope decisions (from brainstorming)

- **All 8 entities in one pass.** They share one CRUD pattern; building the pattern once and stamping it out across all 8 avoids re-deriving conventions across separate sessions.
- **Asset storage: Netlify Blobs.** Matches the planned Netlify deployment. Local development requires running `netlify dev` (not plain `next dev`) so Blobs, and any other Netlify platform emulation, work locally. This changes the local dev command for anyone touching asset-related work — document it in `docs/getting-started.md` as a follow-up.
- **No project gallery UI this pass.** `/admin` stays a placeholder. We seed one `projects` row directly via a script and test all entity pages against that project's UUID. A real "create/select project" UI is separate future work.
- **Generic CRUD framework, both server and client.** A shared server-side handler factory and a shared client-side `<CrudPage>` component carry the common 90% of the pattern; entities with real custom behavior (Teams, Brackets, Project CSS) extend or bypass the generic pieces where the pattern doesn't fit.

## Architecture

### 1. Data layer

- Add all 8 tables to `db/schema.ts`: `assets`, `players`, `talents`, `teams`, `teamPlayers`, `sponsors`, `brackets`, `projectCss`, `videos` — schemas exactly as specified in [data-entities.md](../../data-entities.md).
- Add the shared `extraSchema`/`Extra` type in `db/schemas/shared.ts` (used by Players, Talents, bracket matches).
- One Zod schema file per entity under `db/schemas/<entity>.ts`: `create<Entity>Schema` and `update<Entity>Schema` (update = `.partial()` of create).
- `npm run db:generate` → commit the emitted SQL migration → `npm run db:migrate` against dev `DATABASE_URL`.
- **No seed script needed.** A singleton project already exists: `SEED_PROJECT_ID` (`db/constants.ts`) is seeded idempotently by migration `0001_seed_singleton_project.sql` (`label: 'default'`). All entity pages in this pass are tested against that fixed UUID.

### 2. Asset upload (Netlify Blobs)

- `lib/assets/upload.ts`: server helper wrapping `@netlify/blobs` for storing a file and returning its permanent URL.
- `POST /api/projects/[projectId]/assets/upload`: accepts `multipart/form-data`, stores the blob, inserts an `assets` row (`filename`, `mimeType`, `sizeBytes`, `url`, `kind`), returns the row (`201`).
- Client `<AssetPicker>` component (`components/admin/crud/AssetPickerField.tsx`): upload-new-file or select-existing-asset, reused by every image/video field on Players/Talents/Teams/Sponsors.
- Local dev requires `netlify dev`. No local-disk fallback is built — if `netlify dev` is unavailable, asset upload will not work locally; this is an accepted tradeoff, not a bug.

### 3. Generic CRUD framework — server

- `lib/crud/createCrudHandlers.ts`: factory taking `{ table, createSchema, updateSchema }`, returning route handler functions. Bakes in:
  - `requireSession()` (401 on missing session)
  - `project_id` derived from the URL param, never the body
  - the `and(eq(table.id, params.id), eq(table.projectId, params.projectId))` filter on every single-row mutation (404 if no match — this is the multi-tenancy isolation guarantee, centralized instead of repeated by hand per entity)
  - Zod `.parse()` on write, returning `400` with the Zod error on failure
- Each entity's `route.ts` and `[id]/route.ts` becomes a thin file (~10 lines): import table + schemas, call the factory, re-export the generated `GET`/`POST`/`PATCH`/`DELETE`.
- **Applies unmodified to:** Assets (plus its separate `/upload` route), Players, Talents, Sponsors, Videos.
- **Teams:** base fields go through the factory; roster (`team_players`) is a separate `PUT /api/projects/[projectId]/teams/[teamId]/roster` route that replaces all roster rows in one transaction.
- **Brackets:** `POST /api/projects/[projectId]/brackets` does not insert raw body fields — it calls `generateSingleElim(participantCount)` (`lib/brackets/generate.ts`, per the code in data-entities.md) to build the `rounds` jsonb, then inserts. `PATCH .../brackets/[id]/matches/[matchId]` updates one match inside the `rounds` array (read-modify-write, not a generic column update).
- **Project CSS:** `GET`/`PUT` only (`projectId` is the primary key, one row per project — no list, no delete). `PUT` validates the CSS body rejects `@import url(...)` of remote stylesheets before writing.

### 4. Generic CRUD framework — client

- `components/admin/crud/CrudPage.tsx`: MUI `DataGrid` list + create/edit `Dialog`, driven by an `EntityDef`:
  ```ts
  type FieldDef = {
    name: string;
    label: string;
    widget: 'text' | 'textarea' | 'select' | 'asset-picker' | 'extra-map';
    options?: { value: string; label: string }[]; // for 'select'
  };
  type EntityDef<T> = {
    entityName: string;
    fields: FieldDef[];
    createSchema: ZodSchema;
    updateSchema: ZodSchema;
    api: ReturnType<typeof createEntityApi>; // RTK Query hooks
  };
  ```
- `components/admin/crud/AssetPickerField.tsx`, `ExtraMapField.tsx`: the two non-trivial field widgets; everything else (`text`, `textarea`, `select`) is a thin MUI wrapper.
- Entity defs: `lib/entities/{players,talents,sponsors,videos,assets}.ts` — these five render via `<CrudPage entityDef={...} />` unmodified.
- **Teams:** `<CrudPage>` renders the base fields (name + 4 images); `<TeamRosterEditor>` is a bolted-on section in the same dialog — 5 player-slot `<Select>`s (populated from that project's Players list) + captain/stand-in checkboxes per slot, calling the roster-replace mutation on save.
- **Brackets:** not `<CrudPage>`. `/admin/[projectId]/data/brackets` — simple list + a create form (`name`, `participantCount`). `/admin/[projectId]/data/brackets/[bracketId]` — custom rounds/matches tree view; each match is editable inline (participants, score, status, match type, placeholders, `extra`).
- **Project CSS:** `/admin/[projectId]/data/css` — one `<textarea>` + Save button, no list/dialog.

### 5. State management (RTK Query)

- `store/apis/createEntityApi.ts`: factory generating `list/get/create/update/delete` endpoints with project-scoped tags (`{ type, id: 'LIST:' + projectId }` / `{ type, id }`), per the template in [state-management.md](../../state-management.md). Used directly for Players, Talents, Sponsors, Videos, Assets.
- **Teams:** generated API plus one extra mutation, `replaceRoster({ projectId, teamId, slots })`.
- **Brackets:** hand-written slice — `listBrackets`, `getBracket`, `createBracket`, `updateMatch`.
- **Project CSS:** hand-written slice — `getCss`, `updateCss`.
- `store/index.ts`: wire all new API slices alongside the existing `editor` slice.
- `app/admin/layout.tsx`: add `<Provider store={store}>` — first Redux consumer in the app; doesn't exist yet.

### 6. Routes (this pass only — no project gallery)

```
/admin/[projectId]/data                              — hub, links to the 8 sections
/admin/[projectId]/data/players                       — <CrudPage>
/admin/[projectId]/data/talents                       — <CrudPage>
/admin/[projectId]/data/teams                         — <CrudPage> + roster editor
/admin/[projectId]/data/sponsors                      — <CrudPage>
/admin/[projectId]/data/videos                        — <CrudPage>
/admin/[projectId]/data/assets                        — <CrudPage> (upload-focused)
/admin/[projectId]/data/brackets                      — custom list + create
/admin/[projectId]/data/brackets/[bracketId]          — custom rounds/matches editor
/admin/[projectId]/data/css                           — custom single-row editor
```

`/admin` itself is untouched. Testing uses `SEED_PROJECT_ID` typed directly into the URL.

### 7. Testing

- Vitest unit tests:
  - `generateSingleElim` — 2/4/8/16 participants, round naming, empty-skeleton shape
  - `createCrudHandlers` — mock db, verify session-required (401), verify cross-project isolation (a request scoped to project A with an ID belonging to project B returns 404), verify Zod validation failure returns 400
  - Each entity's Zod schema — one valid case, one or two invalid cases (missing required field, bad UUID, over-length string)
  - `extraSchema` — valid string map, rejects non-string values
- No E2E/browser automation in this pass. Admin UI is verified manually against the seeded project via `netlify dev`.

## Out of scope for this pass

- Project gallery UI (`/admin` create/list projects) — future pass
- Auto-advancing bracket winners through rounds — explicitly out of MVP per data-entities.md
- Local-disk fallback for asset upload under plain `next dev`
- Rundowns / overlay editor / SSE broadcast (separate future passes per the architecture doc)

## Risks / open items

- **Netlify Blobs in `netlify dev`:** first real usage of this local dev flow in the project. If it doesn't behave as expected, we may need to revisit the local-disk-fallback option deferred above.
- **Bracket match editing UI** is the one genuinely custom, non-mechanical piece of admin UI in this pass — budget more design/iteration time for `/admin/[projectId]/data/brackets/[bracketId]` than for the other 7 entities combined.
