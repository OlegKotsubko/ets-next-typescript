# Foundation Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the built P0–P5a data layer and Data-section CRUD to the corrected etalon model (tournaments, integer ids, real entity shapes), removing the invented package/CSS/bracket-generator machinery and the package-coupled overlay/broadcast/controller code.

**Architecture:** Rewrite `db/schema.ts` to the corrected model (integer PKs, `project_id` FK isolation preserved). Reuse the existing generic CRUD factory (`createCrudHandlers` / `createEntityApi` / `CrudPage`); reshape each entity's table + Zod + `EntityDef` + route + RTK slice + admin page. Composite entities (players→photos, teams→logos+roster) get bespoke routes that write child rows alongside the parent. Delete the overlay/broadcast/controller subsystems (rebuilt in later passes).

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Drizzle + Neon HTTP driver · better-auth · Zod · React Hook Form · MUI (+ x-data-grid) · RTK Query · Vitest.

**Design spec:** `docs/superpowers/specs/2026-08-16-foundation-reconciliation-design.md`.

## Global Constraints

- **Integer PKs** (`serial`) for every entity; the only UUID is `displays.uuid` (a deferred table — NOT created this pass). Routes parse `projectId`/`id` as integers.
- **`project_id` FK isolation** preserved exactly: every entity table has `project_id` → `projects.id` `onDelete:'cascade'`; every index leads with `project_id`; `projectId` derives from the URL, never the body.
- **Re-baseline migrations; NEVER run `db:migrate`.** Replace `db/migrations/0000–0003` with one fresh `0000` via `npm run db:generate`. The operator runs `db:migrate` themselves.
- **NEVER read, move, or modify `.env` / `.env.local`.**
- **Auth is untouched** (email+password stays). Do not switch to the username plugin.
- Whole-project `typecheck`/`lint`/`build`/`vitest run` must be green at the FINAL task. **Expect red typecheck/build between Task 2 and Task 13** — Vitest transpiles per-file (esbuild, type-erasing), so per-entity test steps still pass in isolation; whole-project `tsc` is deferred to Task 13. Do not stop the plan for a red whole-project `tsc` before Task 13.
- Tests asserting removed concepts are deleted; tests for changed entities are rewritten.

---

## File Structure

**Rewritten:** `db/schema.ts` (all tables), `db/schemas/*.ts` (Zod per entity), `lib/entities/types.ts` (id:number, new widgets), `lib/crud/createCrudHandlers.ts` (int coercion), `store/apis/createEntityApi.ts` (id:number), `components/admin/crud/CrudPage.tsx` (new widget renderers), `lib/assets/upload.ts` (storage abstraction), `package.json` (scripts), `app/api/projects/route.ts`, `app/(admin)/projects/ProjectsGallery.tsx`, `app/(admin)/projects/[projectId]/{layout,WorkspaceNav}.tsx`, `app/(admin)/projects/[projectId]/data/page.tsx`.

**Per reshaped entity:** `db/schemas/<e>.ts`, `lib/entities/<e>.ts`, `app/api/projects/[projectId]/<e>/route.ts` (+ `[id]/route.ts`), `store/apis/<e>Api.ts`, `app/(admin)/projects/[projectId]/data/<e>/page.tsx`, `test/…`.

**New:** `components/admin/crud/SocialLinksField.tsx`, `components/admin/crud/TypedImagesField.tsx`, `lib/storage/index.ts`.

**Deleted (subsystems + invented):** `projects/` tree · `lib/projects/*` · `lib/titles/*` · `lib/broadcast/*` · `lib/css/*` · `lib/brackets/generate.ts` · `models/*` · `components/admin/rundown/*` · `components/admin/crud/ExtraMapField.tsx` · `db/schemas/{rundown-items,shared}.ts` · `app/api/overlay-packages/` · `app/api/broadcast/` · `app/api/projects/[projectId]/{titles,css}/` · `app/api/projects/[projectId]/rundowns/[id]/items/` · `app/(broadcast)/` · `app/(admin)/dev/` · `app/(admin)/projects/[projectId]/data/css/` · `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx` · `store/apis/{overlayPackagesApi,projectCssApi,rundownItemsApi,titlesApi}.ts` · `scripts/{generate-package-registry,sync-project-assets,generate-title-registry}.ts` · all matching `test/**`.

---

## Task 1: Demolish deferred + invented subsystems

**Files:**
- Delete: everything in the "Deleted" list above **and its tests** (`test/projects/*`, `test/titles/*`, `test/broadcast/*`, `test/app/api/{overlay-packages,broadcast-stream,project-titles,rundown-items,rundown-items-id,rundown-items-order}.test.ts`, `test/app/broadcast-pages.test.tsx`, `test/app/title-preview.test.tsx`, `test/store/apis/{overlayPackagesApi,rundownItemsApi}.test.ts`, `test/lib/{brackets/generate,css/validate-no-remote-import}.test.ts`, `test/components/admin/rundown/*`, `test/components/admin/crud/ExtraMapField.test.tsx`, `test/db/schemas/rundown-items.test.ts`, `test/db/schemas/shared.test.ts`, `test/models/*`, `test/titles/default-package.test.tsx`).
- Also delete the **entity/schema tests that assert old shapes** (rewritten later): `test/db/{schema,entity-schema,roundtrip,rundowns}.test.ts`, `test/db/schemas/players.test.ts`, `test/app/api/{projects,teams-roster,rundowns,rundowns-id}.test.ts`, `test/app/projects.test.tsx`, `test/store/apis/projectsApi.test.ts`, `test/lib/assets/upload.test.ts`, `test/projects/assets.test.ts`.
- Modify: `package.json`, `store/index.ts`, `app/(admin)/providers.tsx` (if it wires removed apis).

- [ ] **Step 1: Delete the code files** in the "Deleted" list (`git rm -r` each path). Do NOT yet touch `db/schema.ts` or the kept entity files.

- [ ] **Step 2: Delete the tests** listed above (`git rm`).

- [ ] **Step 3: Trim `package.json` scripts.** Remove `titles:generate`, `packages:generate`, `assets:sync`, `dev:assets`, `predev`, `prebuild`. Result:
```json
"dev": "next dev",
"build": "next build",
"start": "next start",
```
Remove `"@netlify/blobs"` from `dependencies`.

- [ ] **Step 4: Fix `store/index.ts`.** Remove imports/reducers/middleware for `overlayPackagesApi`, `projectCssApi`, `rundownItemsApi`, `titlesApi`. Leave the remaining entity apis (they still reference old shapes — that's fine for now; Vitest transpiles per-file).

- [ ] **Step 5: Run the surviving suite.**

Run: `npm run test`
Expected: PASS. Any failure is a leftover import of a deleted module — delete/neutralize that test or reference. Iterate until green.

- [ ] **Step 6: Grep for dangling references.**

Run: `grep -rniE "overlay-?package|PackageLabel|getProjectLabel|titleKey|rundownItems|projectCss|generate-title|generate-package|sync-project-assets|@netlify/blobs|brackets/generate" app lib components store scripts db`
Expected: no matches in source (matches only in `docs/**` are fine).

- [ ] **Step 7: Commit.**
```bash
git add -A
git commit -m "chore(reconcile): remove package/overlay/broadcast/controller subsystems and invented CRUD machinery"
```

---

## Task 2: Rewrite schema + Zod + baseline migration + storage abstraction

**Files:**
- Rewrite: `db/schema.ts`
- Rewrite: `db/schemas/{players,teams,talents,sponsors,videos,assets,themes,brackets,tags,rundowns,projects}.ts` (create the ones that don't exist; delete `db/schemas/{rundown-items,shared}.ts` if not already gone).
- Create: `lib/storage/index.ts`; Rewrite: `lib/assets/upload.ts`
- Delete: `db/migrations/0000_*.sql`..`0003_*.sql` + `db/migrations/meta/*`
- Test: `test/db/schema.test.ts` (rewrite)

**Interfaces:**
- Produces tables: `projects, projectTags, projectFavourites, tags, players, playerPhotos, teams, teamLogos, teamPlayers, talents, sponsors, videos, assets, themes, brackets, matches, seatings, rundowns` (+ unchanged auth tables). All entity PKs are `serial` (number).
- Produces Zod: `create<E>Schema`/`update<E>Schema` per entity; composite create schemas carry nested child arrays.

- [ ] **Step 1: Write `db/schema.ts`.** (Auth tables `users/sessions/accounts/verifications` are copied verbatim from the current file — unchanged.)
```ts
import {
  pgEnum, pgTable, serial, integer, text, date, timestamp, jsonb, boolean,
  index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'

// --- better-auth core tables (UNCHANGED — copy verbatim from the current schema.ts) ---
// users, sessions, accounts, verifications  ← keep exactly as they are today.

// --- Disciplines / tags ---
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
})

// --- Tournaments (a "project") ---
export const tournamentStatus = pgEnum('tournament_status', ['draft', 'upcoming', 'ongoing', 'ended'])

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  heroSectionUrl: text('hero_section_url'),
  status: tournamentStatus('status').notNull().default('draft'),
  disciplineId: integer('discipline_id').references(() => tags.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const projectTags = pgTable('project_tags', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.projectId, t.tagId] })])

export const projectFavourites = pgTable('project_favourites', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] })])

// --- Players ---
export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  country: text('country'),
  disciplineId: integer('discipline_id').references(() => tags.id),
  gameId: text('game_id'),
  position: text('position'),
  role: text('role'),
  birthDate: date('birth_date'),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('players_project_idx').on(t.projectId)])

export const playerPhotoType = pgEnum('player_photo_type',
  ['avatar', 'left', 'right', 'roster', 'left_lg', 'right_lg', 'statistics'])

export const playerPhotos = pgTable('player_photos', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  photoType: playerPhotoType('photo_type').notNull(),
  url: text('url').notNull(),
}, (t) => [uniqueIndex('player_photos_unique').on(t.playerId, t.photoType)])

// --- Teams ---
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  country: text('country'),
  region: text('region'),
  disciplineId: integer('discipline_id').references(() => tags.id),
  opendotaId: text('opendota_id'),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('teams_project_idx').on(t.projectId)])

export const teamLogoType = pgEnum('team_logo_type', ['logo', 'ets_logo', 'ets_graphics'])

export const teamLogos = pgTable('team_logos', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  photoType: teamLogoType('photo_type').notNull(),
  url: text('url').notNull(),
})

export const teamPlayers = pgTable('team_players', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  isCaptain: boolean('is_captain').notNull().default(false),
  isStandIn: boolean('is_stand_in').notNull().default(false),
}, (t) => [uniqueIndex('team_players_unique').on(t.teamId, t.playerId)])

// --- Talents ---
export const talents = pgTable('talents', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
  extraText: text('extra_text'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('talents_project_idx').on(t.projectId)])

// --- Videos (declared before sponsors for the FK) ---
export const videoType = pgEnum('video_type', ['mixer', 'background'])
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  videoType: videoType('video_type').notNull().default('background'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('videos_project_idx').on(t.projectId)])

// --- Sponsors ---
export const sponsors = pgTable('sponsors', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  videoId: integer('video_id').references(() => videos.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('sponsors_project_idx').on(t.projectId)])

// --- Assets ---
export const assetType = pgEnum('asset_type', ['decor', 'background'])
export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  assetType: assetType('asset_type').notNull().default('decor'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('assets_project_idx').on(t.projectId)])

// --- Themes ---
export const themes = pgTable('themes', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  colors: jsonb('colors').$type<{ name: string; code: string }[]>().notNull().default([]),
  assetIds: jsonb('asset_ids').$type<number[]>().notNull().default([]),
}, (t) => [index('themes_project_idx').on(t.projectId)])

// --- Brackets / matches / seatings ---
export const brackets = pgTable('brackets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  structure: jsonb('structure').$type<unknown>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('brackets_project_idx').on(t.projectId)])

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  bracketId: integer('bracket_id').references(() => brackets.id, { onDelete: 'set null' }),
  participantLeftId: integer('participant_left_id'),
  participantRightId: integer('participant_right_id'),
  scoreLeft: integer('score_left').notNull().default(0),
  scoreRight: integer('score_right').notNull().default(0),
  status: text('status').notNull().default('scheduled'),
  matchType: text('match_type').notNull().default('bo1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('matches_project_idx').on(t.projectId)])

export const seatings = pgTable('seatings', {
  matchId: integer('match_id').primaryKey().references(() => matches.id, { onDelete: 'cascade' }),
  leftTeamId: integer('left_team_id'),
  rightTeamId: integer('right_team_id'),
  leftTeamPlayers: jsonb('left_team_players').$type<string[]>().notNull().default([]),
  rightTeamPlayers: jsonb('right_team_players').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(false),
})

// --- Rundowns (container; overlays/data land in a later pass) ---
export const rundowns = pgTable('rundowns', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('rundowns_project_idx').on(t.projectId)])
```

- [ ] **Step 2: Write the Zod schemas** (`db/schemas/<e>.ts`). Each exports `create<E>Schema`, `update<E>Schema = create.partial()`, and the inferred types. Concrete forms:
```ts
// db/schemas/tags.ts
export const createTagSchema = z.object({ name: z.string().min(1).max(60) })
// db/schemas/players.ts
const photoType = z.enum(['avatar','left','right','roster','left_lg','right_lg','statistics'])
export const createPlayerSchema = z.object({
  nickname: z.string().min(1).max(25),
  firstName: z.string().max(25).optional(),
  lastName: z.string().max(25).optional(),
  country: z.string().optional(),
  disciplineId: z.number().int().optional(),
  gameId: z.string().regex(/^[a-z0-9]*$/i).optional(),
  position: z.string().optional(),
  role: z.string().optional(),
  birthDate: z.string().date().optional(),
  socialLinks: z.record(z.string(), z.string()).default({}),
  photos: z.array(z.object({ photoType, url: z.string().url() })).optional(),
})
// db/schemas/teams.ts
export const createTeamSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().optional(),
  region: z.string().optional(),
  disciplineId: z.number().int().optional(),
  opendotaId: z.string().optional(),
  socialLinks: z.record(z.string(), z.string()).default({}),
  logos: z.array(z.object({ photoType: z.enum(['logo','ets_logo','ets_graphics']), url: z.string().url() })).optional(),
  roster: z.array(z.object({ playerId: z.number().int(), isCaptain: z.boolean().default(false), isStandIn: z.boolean().default(false) })).max(10).optional(),
})
// db/schemas/talents.ts
export const createTalentSchema = z.object({
  nickname: z.string().min(1).max(60),
  socialLinks: z.record(z.string(), z.string()).default({}),
  extraText: z.string().optional(),
  photoUrl: z.string().url().optional(),
})
// db/schemas/sponsors.ts
export const createSponsorSchema = z.object({
  name: z.string().min(1).max(120),
  logoUrl: z.string().url().optional(),
  videoId: z.number().int().optional(),
})
// db/schemas/videos.ts
export const createVideoSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  videoType: z.enum(['mixer','background']).default('background'),
})
// db/schemas/assets.ts
export const createAssetSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  assetType: z.enum(['decor','background']).default('decor'),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
})
// db/schemas/themes.ts
export const createThemeSchema = z.object({
  name: z.string().min(1).max(120),
  isActive: z.boolean().default(false),
  colors: z.array(z.object({ name: z.string().min(1), code: z.string().min(1) })).default([]),
  assetIds: z.array(z.number().int()).default([]),
})
// db/schemas/brackets.ts
export const createBracketSchema = z.object({
  name: z.string().min(1).max(120),
  structure: z.unknown().default({}),
})
export const createMatchSchema = z.object({
  bracketId: z.number().int().optional(),
  participantLeftId: z.number().int().optional(),
  participantRightId: z.number().int().optional(),
  scoreLeft: z.number().int().default(0),
  scoreRight: z.number().int().default(0),
  status: z.enum(['scheduled','active','finished']).default('scheduled'),
  matchType: z.string().default('bo1'),
})
export const upsertSeatingSchema = z.object({
  leftTeamId: z.number().int().optional(),
  rightTeamId: z.number().int().optional(),
  leftTeamPlayers: z.array(z.string()).default([]),
  rightTeamPlayers: z.array(z.string()).default([]),
  isActive: z.boolean().default(false),
})
// db/schemas/rundowns.ts (reshape)
export const createRundownSchema = z.object({ name: z.string().min(1).max(120), image: z.string().url().optional() })
// db/schemas/projects.ts (tournaments — no create; favourites toggle only)
export const setFavouriteSchema = z.object({ favourite: z.boolean() })
```
Delete `db/schemas/shared.ts` and `db/schemas/rundown-items.ts` if Task 1 didn't.

- [ ] **Step 3: Write the storage abstraction.**
```ts
// lib/storage/index.ts — de-Netlified upload target. Dev/default writes under public/media.
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export type StoredObject = { url: string; sizeBytes: number }

export async function putObject(key: string, bytes: ArrayBuffer, _mimeType: string): Promise<StoredObject> {
  const rel = join('media', key)
  const abs = join(process.cwd(), 'public', rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, Buffer.from(bytes))
  return { url: `/${rel}`, sizeBytes: bytes.byteLength }
}
```
```ts
// lib/assets/upload.ts (rewrite)
import { putObject } from '@/lib/storage'
export async function uploadAsset(projectId: string, file: File) {
  const key = `${projectId}/${crypto.randomUUID()}-${file.name}`
  return putObject(key, await file.arrayBuffer(), file.type)
}
```
Add `/public/media/` to `.gitignore`.

- [ ] **Step 4: Reset migrations.** Delete `db/migrations/0000_*`..`0003_*` and `db/migrations/meta/*`. Then:

Run: `npm run db:generate`
Expected: a single new `db/migrations/0000_*.sql` describing the full schema; no error. (This only diffs schema → SQL; it does NOT touch any database.)

- [ ] **Step 5: Rewrite `test/db/schema.test.ts`** to assert the corrected surface:
```ts
import { describe, it, expect } from 'vitest'
import * as schema from '@/db/schema'
describe('schema', () => {
  it('exposes the corrected tournament + entity tables', () => {
    for (const t of ['projects','projectTags','projectFavourites','tags','players','playerPhotos',
      'teams','teamLogos','teamPlayers','talents','sponsors','videos','assets','themes',
      'brackets','matches','seatings','rundowns']) {
      expect(schema).toHaveProperty(t)
    }
  })
  it('dropped the invented projects columns', () => {
    expect(Object.keys(schema.projects)).not.toContain('mode')
    expect(Object.keys(schema.projects)).not.toContain('label')
  })
})
```
Run: `npm run test -- test/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add -A
git commit -m "feat(db): rewrite schema to corrected tournament/integer-id model + baseline migration"
```

---

## Task 3: Reconcile shared CRUD machinery + field widgets

**Files:**
- Modify: `lib/crud/createCrudHandlers.ts` (int coercion), `lib/entities/types.ts` (id:number, widget union), `store/apis/createEntityApi.ts` (id:number), `components/admin/crud/CrudPage.tsx` (new renderers, id:number)
- Create: `components/admin/crud/SocialLinksField.tsx`, `components/admin/crud/TypedImagesField.tsx`
- Test: `test/lib/crud/createCrudHandlers.test.ts` (update for int ids), `test/components/admin/crud/SocialLinksField.test.tsx`

**Interfaces:**
- Produces `FieldDef.widget` union: `'text' | 'textarea' | 'select' | 'social-links' | 'typed-images' | 'asset-picker'`; `FieldDef` gains optional `photoTypes?: string[]` (for `typed-images`) and `optionsFrom?: 'tags'` (dynamic select).
- `createCrudHandlers` coerces `projectId`/`id` to `Number(...)` before every `eq(...)`.
- `EntityDef<TRow>`/`CrudPage<TRow extends { id: number }>`; RTK arg ids become `number`.

- [ ] **Step 1: Write the failing test for int coercion.**
```ts
// test/lib/crud/createCrudHandlers.test.ts (rewrite)
// Assert GET filters with a numeric projectId (mock db capturing the eq arg),
// and PATCH/DELETE coerce string route ids to numbers.
```
Run it; expect FAIL.

- [ ] **Step 2: Update `createCrudHandlers.ts`.** Replace `eq(table.projectId, projectId)` with `eq(table.projectId, Number(projectId))` and `eq(table.id, id as string)` with `eq(table.id, Number(id))` in GET/POST/PATCH/DELETE. Keep the `db as any` escape hatch. **Extract the inline `requireSession(req)` helper into `lib/crud/requireSession.ts`** (exported) and import it here, so bespoke composite routes (players/teams) reuse the same guard.

Run: `npm run test -- test/lib/crud/createCrudHandlers.test.ts` → PASS.

- [ ] **Step 3: Widen `FieldDef` + `EntityDef` (`lib/entities/types.ts`).**
```ts
export type FieldDef = {
  name: string
  label: string
  widget: 'text' | 'textarea' | 'select' | 'social-links' | 'typed-images' | 'asset-picker'
  options?: { value: string; label: string }[]
  optionsFrom?: 'tags'
  photoTypes?: string[]
}
export type EntityDef<TRow> = {
  entityName: string
  fields: FieldDef[]
  createSchema: ZodTypeAny
  columns: { field: keyof TRow & string; headerName: string }[]
}
```

- [ ] **Step 4: `SocialLinksField`** — repeatable `{ type, link }` rows editing a `Record<string,string>` value (add/remove row; `onChange` emits the map). MUI `TextField` pairs + Add/Remove buttons.

- [ ] **Step 5: `TypedImagesField`** — given `photoTypes`, render one URL input per type; value/`onChange` is an array `[{ photoType, url }]` (drop empty urls). Used for `players.photos` and `teams.logos`.

- [ ] **Step 6: Update `CrudPage.tsx`.** Change `TRow extends { id: number }`; drop the `ExtraMapField` import; add renderers for `social-links` (→`SocialLinksField`), `typed-images` (→`TypedImagesField`), and dynamic `select` where `field.optionsFrom === 'tags'` loads options via the **global** `useListTagsQuery()` (tags are global — see Task 4, no `projectId` arg). `getRowId={(r)=>r.id}` already works for numbers.

- [ ] **Step 7: Update `store/apis/createEntityApi.ts`** arg types `id: string` → `id: number` (URL interpolation is unchanged).

- [ ] **Step 8: Run tests + commit.**
```bash
npm run test -- test/lib/crud test/components/admin/crud
git add -A && git commit -m "refactor(crud): integer ids + social-links/typed-images field widgets"
```

---

## Task 4: Tags (disciplines) CRUD — GLOBAL, not project-scoped

**Why global:** in the etalon, disciplines/tags are one shared vocabulary (`tag-management-service`) that tournaments, players, and teams all reference. They are **not** `project_id`-scoped, so they do **not** use the project factory and live at a top-level `/api/tags`.

**Files:** `lib/entities/tags.ts` (type + `EntityDef` for the admin grid), `app/api/tags/route.ts` (+ `app/api/tags/[id]/route.ts`) — bespoke global handlers, session-guarded, **no** `projectId`; `store/apis/tagsApi.ts` (a plain `createApi`, base `/tags`); `app/(admin)/projects/[projectId]/data/tags/page.tsx` (manages the global tags from within the workspace for now), `test/app/api/tags.test.ts`, `store/index.ts`.

**Interfaces:** Produces the **global** `tagsApi` with `useListTagsQuery()` (no args) — consumed by Task 3's dynamic `disciplineId` select and by every entity with a discipline field.

- [ ] **Step 1: `lib/entities/tags.ts`.**
```ts
export type Tag = { id: number; name: string }
```
(A full `EntityDef` isn't required — the tags page can be a thin bespoke list/create dialog since it doesn't ride the project factory. Keep it minimal: name-only.)

- [ ] **Step 2: Global routes** (bespoke; session-guarded via `requireSession`):
```ts
// app/api/tags/route.ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tags } from '@/db/schema'
import { createTagSchema } from '@/db/schemas/tags'
import { requireSession } from '@/lib/crud/requireSession'
export async function GET(req: Request) {
  if (await requireSession(req)) return new Response('Unauthorized', { status: 401 })
  return Response.json(await db.select().from(tags))
}
export async function POST(req: Request) {
  if (await requireSession(req)) return new Response('Unauthorized', { status: 401 })
  const parsed = createTagSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(tags).values(parsed.data).returning()
  return Response.json(row, { status: 201 })
}
```
`app/api/tags/[id]/route.ts`: PATCH/DELETE filtering on `eq(tags.id, Number(id))` only (no project filter).

- [ ] **Step 3: `store/apis/tagsApi.ts`** — a plain `createApi` (base `/api`), `tagTypes:['Tag']`, endpoints `listTags` (`query: () => '/tags'`), `createTag`/`updateTag`/`deleteTag`. Export `useListTagsQuery` etc. Register in `store/index.ts`.

- [ ] **Step 4: `data/tags/page.tsx`** — a small bespoke MUI list + add/edit dialog bound to `tagsApi` (name only). Not a `CrudPage` (that factory assumes a `projectId`).

- [ ] **Step 5: Test** `test/app/api/tags.test.ts` — POST rejects missing name (400); POST inserts a global tag; GET returns all tags (no project filter).

Run: `npm run test -- test/app/api/tags.test.ts` → PASS.

- [ ] **Step 6: Commit.** `git commit -am "feat(data): global tags/disciplines CRUD"`

---

## Task 5: Projects (tournaments) gallery + favourites

**Files:** `app/api/projects/route.ts` (list + status filter), `app/api/projects/[projectId]/favourite/route.ts` (PUT/DELETE toggle), `store/apis/projectsApi.ts`, `app/(admin)/projects/ProjectsGallery.tsx`, `app/(admin)/projects/[projectId]/layout.tsx` + `WorkspaceNav.tsx`, `app/(admin)/projects/[projectId]/data/page.tsx`, `test/app/api/projects.test.ts`, `test/store/apis/projectsApi.test.ts`.

**Interfaces:** `GET /api/projects?status=` → tournament rows (no POST). Workspace nav links: Data / Overlays / MIDI / Bluetooth (Overlays/MIDI/Bluetooth are later-pass stubs).

- [ ] **Step 1: `GET /api/projects`** — session-guarded; `db.select().from(projects)` optionally `.where(eq(projects.status, status))`; join favourites for the current user (`project_favourites`) to mark `isFavourite`. Remove the old package-label logic. No POST.

- [ ] **Step 2: Favourite toggle** — `PUT` inserts, `DELETE` removes a `project_favourites` row for `(projectId, session.user.id)`.

- [ ] **Step 3: `projectsApi`** — `listProjects` query (arg `{ status? }`), `setFavourite`/`unsetFavourite` mutations invalidating the list. Types: `Project = { id:number; title:string; heroSectionUrl:string|null; status:'draft'|'upcoming'|'ongoing'|'ended'; disciplineId:number|null; isFavourite:boolean }`.

- [ ] **Step 4: `ProjectsGallery`** — cards keyed by `title`/`heroSectionUrl`/`status`; a status filter; a favourite star calling the mutations. Remove all package-label references.

- [ ] **Step 5: Workspace `layout.tsx`/`WorkspaceNav.tsx`** — nav to `data`, `overlays`, `midi`, `bluetooth` (latter three route to a simple "coming in a later pass" placeholder page, or omit until built — keep `data` working). `data/page.tsx` lists the entity sections: Players, Teams, Talents, Sponsors, Tags, Themes, Matches, Assets, Videos. Remove the `css` link.

- [ ] **Step 6: Tests** — `test/app/api/projects.test.ts` (GET returns tournaments, status filter, no POST route), `test/store/apis/projectsApi.test.ts` (list + favourite mutation shapes). Run them → PASS.

- [ ] **Step 7: Commit.** `git commit -am "feat(tournaments): projects gallery + favourites, no create"`

---

## Task 6: Players + player_photos (the composite-entity template)

**Files:** `lib/entities/players.ts`, `app/api/projects/[projectId]/players/route.ts` + `[id]/route.ts` (bespoke composite handlers), `store/apis/playersApi.ts`, `app/(admin)/projects/[projectId]/data/players/page.tsx`, `test/app/api/players.test.ts`.

**Interfaces:** Establishes the composite create/update pattern (parent row + `replaceChildren`) that Task 7 (teams) copies.

- [ ] **Step 1: `lib/entities/players.ts`** — new `Player` type (id:number, corrected fields, `photos: {photoType,url}[]`), `EntityDef` fields: `nickname` (text), `firstName`/`lastName`/`country`/`gameId`/`position`/`role` (text), `birthDate` (text), `disciplineId` (select, `optionsFrom:'tags'`), `socialLinks` (social-links), `photos` (typed-images, `photoTypes:['avatar','left','right','roster','left_lg','right_lg','statistics']`). Columns: nickname/firstName/lastName/country.

- [ ] **Step 2: Write the failing composite-route test** `test/app/api/players.test.ts` — POST with `photos:[{photoType:'avatar',url}]` inserts the player and one `player_photos` row; PATCH replaces photos; body `projectId` is ignored.

- [ ] **Step 3: Bespoke route** (players cannot use the bare factory because of `photos`):
```ts
// app/api/projects/[projectId]/players/route.ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, playerPhotos } from '@/db/schema'
import { createPlayerSchema } from '@/db/schemas/players'
import { requireSession } from '@/lib/crud/requireSession' // extract the helper from createCrudHandlers in Task 3

export async function GET(req: Request, { params }) {
  if (await requireSession(req)) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const rows = await db.select().from(players).where(eq(players.projectId, Number(projectId)))
  return Response.json(rows)
}
export async function POST(req: Request, { params }) {
  if (await requireSession(req)) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const parsed = createPlayerSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { photos = [], ...fields } = parsed.data
  const [row] = await db.insert(players).values({ ...fields, projectId: Number(projectId) }).returning()
  if (photos.length) await db.insert(playerPhotos).values(photos.map((p) => ({ ...p, playerId: row.id })))
  return Response.json(row, { status: 201 })
}
```
`[id]/route.ts` PATCH: update fields on `and(eq(players.id, Number(id)), eq(players.projectId, Number(projectId)))`; if `photos` present, `delete` existing `player_photos` for the player then insert the new set (wrap the two writes in `db.transaction` if supported by neon-http, else sequential). DELETE: as factory. Extract `requireSession` into `lib/crud/requireSession.ts` (exported) in Task 3 so both the factory and bespoke routes share it.

- [ ] **Step 4: `playersApi` + page** — `Player`/`CreatePlayerInput`/`UpdatePlayerInput` types updated; page unchanged (5-line wrapper). Run `test/app/api/players.test.ts` → PASS.

- [ ] **Step 5: Commit.** `git commit -am "feat(data): players + typed photos (composite CRUD)"`

---

## Task 7: Teams + team_logos + team_players

**Files:** `lib/entities/teams.ts`, `app/api/projects/[projectId]/teams/route.ts` + `[id]/route.ts` (bespoke, composite), `store/apis/teamsApi.ts`, `data/teams/page.tsx`, `test/app/api/teams.test.ts`. Delete the old `teams/[id]/roster/route.ts` (folded into the composite update) + `test/app/api/teams-roster.test.ts`.

- [ ] **Step 1: `Team` type + `EntityDef`** — fields name/country/region/opendotaId (text), disciplineId (select `optionsFrom:'tags'`), socialLinks (social-links), logos (typed-images `photoTypes:['logo','ets_logo','ets_graphics']`), roster (a dedicated roster widget or reuse `TeamRosterEditor` — keep the existing `components/admin/crud/TeamRosterEditor.tsx`, migrate it to integer player ids).
- [ ] **Step 2: Bespoke route** — same shape as players; on create/update also replace `team_logos` and `team_players` from `logos[]`/`roster[]`. Follow Task 6's `replaceChildren` pattern for both child tables.
- [ ] **Step 3: `teamsApi` + page + test** (`test/app/api/teams.test.ts`: create with logos + roster writes both child tables; roster capped at 10). Run → PASS.
- [ ] **Step 4: Commit.** `git commit -am "feat(data): teams + logos + roster (composite CRUD)"`

---

## Task 8: Talents + Sponsors

**Files:** `lib/entities/{talents,sponsors}.ts`, the four route files, `store/apis/{talentsApi,sponsorsApi}.ts`, `data/{talents,sponsors}/page.tsx`, `test/app/api/{talents,sponsors}.test.ts`.

- [ ] **Step 1: Talents** — simple factory entity. `EntityDef` fields: nickname (text), extraText (textarea), photoUrl (asset-picker), socialLinks (social-links). Routes via `createCrudHandlers`. Api + page copy Task 4's template.
- [ ] **Step 2: Sponsors** — simple factory entity. Fields: name (text), logoUrl (asset-picker), videoId (select `optionsFrom` a videos list — or a plain number text field for this pass). Routes via factory. Api + page.
- [ ] **Step 3: Tests** for both (create validation + project-scoped list). Run → PASS.
- [ ] **Step 4: Commit.** `git commit -am "feat(data): talents + sponsors CRUD"`

---

## Task 9: Assets + Videos (+ upload)

**Files:** `lib/entities/{assets,videos}.ts`, routes, `store/apis/{assetsApi,videosApi}.ts`, `data/{assets,videos}/page.tsx`, `app/api/projects/[projectId]/assets/upload/route.ts` (rewrite to `uploadAsset`), `test/app/api/{assets,videos}.test.ts`, `test/lib/assets/upload.test.ts`.

- [ ] **Step 1: Assets** — factory entity: name (text), url (text/asset-picker), assetType (select `[decor,background]`), created via factory. Keep the `upload` route but back it with `lib/assets/upload.ts` → `putObject`; on upload, insert an `assets` row and return it.
- [ ] **Step 2: Videos** — factory entity: name (text), url (text), videoType (select `[mixer,background]`).
- [ ] **Step 3: Tests** — upload writes a file via the storage layer (mock `putObject`) and inserts an asset row; videos CRUD. Run → PASS.
- [ ] **Step 4: Commit.** `git commit -am "feat(data): assets + videos CRUD with de-Netlified upload"`

---

## Task 10: Themes (replaces project_css)

**Files:** `lib/entities/themes.ts`, routes (+ an `activate` semantics), `store/apis/themesApi.ts`, `data/themes/page.tsx`, `test/app/api/themes.test.ts`.

- [ ] **Step 1: Theme entity** — fields name (text), isActive (a checkbox/toggle), colors (a repeatable `{name,code}` editor — reuse `SocialLinksField`'s repeatable pattern as a `ColorsField`, or a JSON textarea for this pass), assetIds (multi-select of assets or a number-list field).
- [ ] **Step 2: Routes** — factory GET/POST/PATCH/DELETE. Add invariant: setting `isActive:true` deactivates the project's other themes (in PATCH/POST, when `isActive` is true, `db.update(themes).set({isActive:false}).where(eq(themes.projectId, pid))` first). Test this invariant.
- [ ] **Step 3: `themesApi` + page + test** (`test/app/api/themes.test.ts`: activating one theme deactivates the rest in the same project). Run → PASS.
- [ ] **Step 4: Commit.** `git commit -am "feat(data): themes CRUD (single active per tournament), replacing project_css"`

---

## Task 11: Brackets + Matches + Seatings

**Files:** `lib/entities/{brackets,matches}.ts`, `app/api/projects/[projectId]/brackets/route.ts` (+`[id]`), `app/api/projects/[projectId]/matches/route.ts` (+`[id]`), `app/api/projects/[projectId]/matches/[id]/seating/route.ts`, `store/apis/{bracketsApi,matchesApi}.ts`, `data/{brackets,matches}/page.tsx`, `test/app/api/{brackets,matches,seating}.test.ts`. Delete the old `brackets` route/page and `store/apis/bracketsApi.ts` (rebuilt), and `lib/brackets/generate.ts` if Task 1 didn't.

- [ ] **Step 1: Brackets** — factory entity: name (text), structure (JSON textarea → validated `z.unknown()`; no `participant_count`). Routes via factory. Api + page.
- [ ] **Step 2: Matches** — factory entity for the scalar fields: bracketId/participantLeftId/participantRightId/scoreLeft/scoreRight (number), status (select), matchType (text). Routes via factory. Api + page.
- [ ] **Step 3: Seating** — bespoke `GET`/`PUT` at `matches/[id]/seating`: upsert one `seatings` row keyed by `matchId` (validate ownership via the parent match's `projectId`); `upsertSeatingSchema`. Setting `isActive:true` clears `isActive` on the project's other seatings (join through matches).
- [ ] **Step 4: Tests** — bracket create rejects nothing invented (`participant_count` no longer accepted); match CRUD; seating upsert + single-active invariant. Run → PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(data): brackets (stored tree) + matches + seatings, replacing the generator"`

---

## Task 12: Rundowns reshape

**Files:** `lib/entities/rundowns.ts`, `app/api/projects/[projectId]/rundowns/route.ts` (+`[id]`), `store/apis/rundownsApi.ts`, `app/(admin)/projects/[projectId]/rundowns/page.tsx`, `test/app/api/rundowns.test.ts`, `test/db/rundowns.test.ts`.

- [ ] **Step 1: Reshape** — `rundowns` now int id + `userId` + `image`. Create/list route sets `userId` from the session; `createRundownSchema` = `{ name, image? }`. Keep only list + create + delete for this pass (the editor/overlays are a later pass). Remove the `[rundownId]` editor page (deleted in Task 1) — the rundowns list page just lists/creates/deletes.
- [ ] **Step 2: Api + page + tests.** Run `test/app/api/rundowns.test.ts` + `test/db/rundowns.test.ts` → PASS.
- [ ] **Step 3: Commit.** `git commit -am "feat(rundowns): reshape to integer id + owner + cover image (list/create/delete)"`

---

## Task 13: Whole-project integration + green gate

**Files:** any dangling references surfaced by `tsc`/`build`; `store/index.ts` (final api registration list); `app/(admin)/projects/[projectId]/data/page.tsx` (final section list).

- [ ] **Step 1: Typecheck.** Run `npm run typecheck`. Fix every remaining whole-project error (dangling imports, `id:string`↔`number`, removed modules). Repeat until clean.
- [ ] **Step 2: Lint.** Run `npm run lint`. Fix. (Match the existing eslint style.)
- [ ] **Step 3: Build.** Run `npm run build`. Fix any route/type/build error. (No `predev`/`prebuild` codegen should remain.)
- [ ] **Step 4: Full suite.** Run `npm run test`. All green. No test references a removed concept.
- [ ] **Step 5: Dropped-term sweep.**
```bash
grep -rniE "project_mode|project_label|overlay.?package|participant_count|extraSchema|avatarAssetId|@netlify/blobs|titleKey|rundown_items|project_css|projects/default" app lib components store db scripts
```
Expected: no matches outside `docs/**`.
- [ ] **Step 6: New-model spot check.** Confirm `projects` has `title/status/discipline_id`; `player_photos`/`team_logos`/`matches`/`seatings`/`themes`/`tags` exist; a sample entity route parses an integer `projectId`.
- [ ] **Step 7: Commit.** `git commit -am "chore(reconcile): whole-project green — typecheck, lint, build, tests"`

---

## Self-review notes (author)

- **Spec coverage:** schema (T2), entity CRUD players/teams/talents/sponsors/tags/themes/assets/videos/matches (T4–T11), projects gallery (T5), rundowns (T12), removals (T1), storage (T2/T9), verification (T13) — all mapped.
- **`tags` are global** (not `project_id`-scoped): they live at `/api/tags` with bespoke handlers, matching the etalon's shared discipline vocabulary. This is the one entity that intentionally sits outside the `/api/projects/[projectId]` factory (T4). Its admin page is placed under the workspace Data section for convenience this pass.
- **Transactions:** child-table replace uses `db.transaction` if the neon-http driver supports it in the pinned version; otherwise sequential writes (T6). Verify the driver's behavior during T6 and pick one.
- **Red window:** whole-project `tsc`/`build` is red from T2→T13 by design; per-entity Vitest steps stay green because esbuild transpiles per file. T13 is the whole-project gate.
