# Data Entities CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Data section of the admin — 8 entity types (Assets, Players, Talents, Teams, Sponsors, Brackets, Project CSS, Videos), each with a Postgres table, Zod schema, REST routes under `/api/projects/[projectId]/<entity>`, and an admin UI page — using a shared CRUD framework on both server and client.

**Architecture:** A generic server-side handler factory (`createCrudHandlers`) and a generic client-side `<CrudPage>` component carry the common list/create/read/update/delete pattern for 5 of the 8 entities (Assets, Players, Talents, Sponsors, Videos). Teams, Brackets, and Project CSS extend or bypass the generic pieces where their behavior is genuinely different (a join-table roster, generated bracket trees, a single CSS row). Asset files upload to Netlify Blobs.

**Tech Stack:** Next.js 16 App Router (Node runtime), Drizzle ORM + Neon Postgres, Zod, MUI + `@mui/x-data-grid`, React Hook Form + `@hookform/resolvers/zod`, Redux Toolkit + RTK Query, `@netlify/blobs`, Vitest.

## Global Constraints

- Every entity table has `project_id uuid not null references projects(id) on delete cascade`. No exceptions. (docs/database.md)
- Every entity API route lives under `/api/projects/[projectId]/...`; the server derives `projectId` from the URL, **never** the request body. (docs/database.md, CLAUDE.md)
- Every mutation on a single row filters `and(eq(table.id, params.id), eq(table.projectId, params.projectId))`. (docs/data-entities.md)
- RTK Query cache tags always include the project ID: `{ type, id: 'LIST:' + projectId }` for lists, `{ type, id }` for single rows. (docs/state-management.md)
- Testing uses the fixed singleton project `SEED_PROJECT_ID` from `db/constants.ts` (`'00000000-0000-0000-0000-000000000001'`) — already seeded by migration `0001_seed_singleton_project.sql`. No new seed script.
- Image/video fields are asset references (`uuid` FK to `assets.id`, `onDelete: 'set null'`), never raw URLs. (docs/data-entities.md)
- `extra` fields use the shared `extraSchema` (`z.record(z.string().min(1), z.string()).default({})`). (docs/data-entities.md)
- No migration runs as part of `next build` — `db:migrate` is a separate manual/CI step. (CLAUDE.md)
- Local dev for anything touching assets requires `netlify dev`, not plain `next dev`.
- No project gallery UI in this pass — `/admin` stays a placeholder.

---

## Task 1: Install dependencies and scaffold Netlify config

**Files:**
- Modify: `package.json`
- Create: `netlify.toml`

**Interfaces:**
- Produces: `@netlify/blobs` (server upload helper in Task 6), `@mui/x-data-grid` (Task 8's `<CrudPage>`), `react-hook-form` + `@hookform/resolvers` (Task 8's form dialog), `netlify-cli` as a dev dependency (documented as the new local dev command).

- [ ] **Step 1: Install runtime and dev dependencies**

```bash
npm install @netlify/blobs @mui/x-data-grid react-hook-form @hookform/resolvers
npm install -D netlify-cli
```

- [ ] **Step 2: Create a minimal `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = ".next"

[dev]
  command = "npm run dev"
  targetPort = 3000
```

- [ ] **Step 3: Verify the CLI runs**

Run: `npx netlify --version`
Expected: prints a version string (confirms `netlify-cli` installed correctly; do not start the dev server yet — no site is linked).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json netlify.toml
git commit -m "chore: add Netlify Blobs, MUI DataGrid, React Hook Form deps"
```

---

## Task 2: Shared `extra` schema

**Files:**
- Create: `db/schemas/shared.ts`
- Test: `test/db/schemas/shared.test.ts`

**Interfaces:**
- Produces: `extraSchema: ZodSchema<Extra>`, `type Extra = Record<string, string>` — consumed by Players, Talents, and Bracket match schemas (Tasks 9, 10, 13).

- [ ] **Step 1: Write the failing test**

```ts
// test/db/schemas/shared.test.ts
import { describe, it, expect } from 'vitest'
import { extraSchema } from '@/db/schemas/shared'

describe('extraSchema', () => {
  it('accepts a string-to-string map', () => {
    const result = extraSchema.parse({ jersey: '23', hometown: 'Austin' })
    expect(result).toEqual({ jersey: '23', hometown: 'Austin' })
  })

  it('defaults to an empty object when omitted', () => {
    expect(extraSchema.parse(undefined)).toEqual({})
  })

  it('rejects a non-string value', () => {
    expect(() => extraSchema.parse({ jersey: 23 })).toThrow()
  })

  it('rejects an empty-string key', () => {
    expect(() => extraSchema.parse({ '': 'x' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db/schemas/shared.test.ts`
Expected: FAIL — `Cannot find module '@/db/schemas/shared'`

- [ ] **Step 3: Write the implementation**

```ts
// db/schemas/shared.ts
import { z } from 'zod'

export const extraSchema = z.record(z.string().min(1), z.string()).default({})
export type Extra = z.infer<typeof extraSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db/schemas/shared.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add db/schemas/shared.ts test/db/schemas/shared.test.ts
git commit -m "feat(db): shared extra string-map schema"
```

---

## Task 3: Add all 8 entity tables to `db/schema.ts` and migrate

**Files:**
- Modify: `db/schema.ts`
- Create: `db/migrations/<generated>.sql` (via `db:generate`, do not hand-write)
- Test: `test/db/entity-schema.test.ts`

**Interfaces:**
- Produces: Drizzle tables `assets`, `players`, `talents`, `teams`, `teamPlayers`, `sponsors`, `brackets`, `projectCss`, `videos`, all exported from `db/schema.ts` — consumed by every later task's route handlers and Zod schemas.

- [ ] **Step 1: Write the failing test**

```ts
// test/db/entity-schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  assets, players, talents, teams, teamPlayers, sponsors, brackets, projectCss, videos,
} from '@/db/schema'

describe('entity tables', () => {
  it('exports all 8 entity tables plus the team_players join', () => {
    expect(assets).toBeDefined()
    expect(players).toBeDefined()
    expect(talents).toBeDefined()
    expect(teams).toBeDefined()
    expect(teamPlayers).toBeDefined()
    expect(sponsors).toBeDefined()
    expect(brackets).toBeDefined()
    expect(projectCss).toBeDefined()
    expect(videos).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db/entity-schema.test.ts`
Expected: FAIL — the named exports don't exist yet.

- [ ] **Step 3: Append all 8 tables to `db/schema.ts`**

Add after the existing `rundownItems` export (keep all existing exports untouched):

```ts
// --- Data entities ---------------------------------------------------------

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  url: text('url').notNull(),
  kind: text('kind').notNull(), // 'logo' | 'photo' | 'graphic' | 'other'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('assets_project_idx').on(t.projectId)])

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  surname: text('surname'),
  nickname: text('nickname'),
  avatarAssetId: uuid('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  leftImageAssetId: uuid('left_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rightImageAssetId: uuid('right_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterAssetId: uuid('roster_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterLeftAssetId: uuid('roster_left_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterRightAssetId: uuid('roster_right_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  extra: jsonb('extra').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('players_project_idx').on(t.projectId)])

export const talents = pgTable('talents', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  surname: text('surname'),
  nickname: text('nickname'),
  avatarAssetId: uuid('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  leftImageAssetId: uuid('left_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rightImageAssetId: uuid('right_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterAssetId: uuid('roster_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterLeftAssetId: uuid('roster_left_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterRightAssetId: uuid('roster_right_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  extra: jsonb('extra').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('talents_project_idx').on(t.projectId)])

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  avatarAssetId: uuid('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  leftImageAssetId: uuid('left_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rightImageAssetId: uuid('right_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  bigAvatarAssetId: uuid('big_avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('teams_project_idx').on(t.projectId)])

export const teamPlayers = pgTable('team_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  slot: integer('slot').notNull(),
  isCaptain: boolean('is_captain').notNull().default(false),
  isStandIn: boolean('is_stand_in').notNull().default(false),
}, (t) => [
  index('team_players_team_idx').on(t.teamId, t.slot),
  uniqueIndex('team_players_unique').on(t.teamId, t.playerId),
])

export const sponsors = pgTable('sponsors', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: text('position'),
  imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  bigImageAssetId: uuid('big_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('sponsors_project_idx').on(t.projectId)])

export const brackets = pgTable('brackets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  format: text('format').notNull().default('single-elim'),
  participantCount: integer('participant_count').notNull(),
  rounds: jsonb('rounds').$type<unknown[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('brackets_project_idx').on(t.projectId)])

export const projectCss = pgTable('project_css', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  css: text('css').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  durationMs: integer('duration_ms'),
  loop: boolean('loop').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('videos_project_idx').on(t.projectId)])
```

Add `uniqueIndex` to the existing `drizzle-orm/pg-core` import at the top of the file (alongside `pgEnum, pgTable, uuid, text, date, timestamp, integer, jsonb, index, boolean`).

> Note: `sponsors` references `videos.id` but is declared before `videos` in the file above — Drizzle table objects reference each other by JS identifier, not declaration order, so as long as both `export const` statements exist in the module this resolves fine. Keep `videos` declared anywhere in the same file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db/entity-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Generate and inspect the migration**

Run: `npm run db:generate`
Expected: a new file appears under `db/migrations/`, e.g. `0003_<name>.sql`, creating all 8 tables plus their indexes and FKs. Open it and confirm it does **not** touch `projects`, `users`, `sessions`, `accounts`, `verifications`, `rundowns`, or `rundown_items`.

- [ ] **Step 6: Apply the migration to the dev database**

Run: `npm run db:migrate`
Expected: exits 0; the new tables exist in the dev `DATABASE_URL`.

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts db/migrations/ test/db/entity-schema.test.ts
git commit -m "feat(db): add 8 data-entity tables and team_players join"
```

---

## Task 4: Generic server CRUD handler factory

**Files:**
- Create: `lib/crud/createCrudHandlers.ts`
- Test: `test/lib/crud/createCrudHandlers.test.ts`

**Interfaces:**
- Consumes: any Drizzle `PgTable` with `id` and `projectId` columns; a Zod create schema; a Zod update schema; `db` from `db/index.ts`; `auth` from `lib/auth.ts`.
- Produces:
  ```ts
  type CrudConfig<TTable extends PgTableWithColumns<any>> = {
    table: TTable
    createSchema: z.ZodTypeAny
    updateSchema: z.ZodTypeAny
  }
  function createCrudHandlers<TTable>(config: CrudConfig<TTable>): {
    GET: (req: Request, ctx: { params: Promise<{ projectId: string }> }) => Promise<Response>
    POST: (req: Request, ctx: { params: Promise<{ projectId: string }> }) => Promise<Response>
    PATCH: (req: Request, ctx: { params: Promise<{ projectId: string; id: string }> }) => Promise<Response>
    DELETE: (req: Request, ctx: { params: Promise<{ projectId: string; id: string }> }) => Promise<Response>
  }
  ```
  Consumed by every entity's `route.ts` in Tasks 9–12.

- [ ] **Step 1: Write the failing test**

```ts
// test/lib/crud/createCrudHandlers.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { pgTable, uuid, text } from 'drizzle-orm/pg-core'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const dbMock = {
  query: { widgets: { findMany: vi.fn(), findFirst: vi.fn() } },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}
vi.mock('@/db', () => ({ db: dbMock }))

const { createCrudHandlers } = await import('@/lib/crud/createCrudHandlers')

const widgets = pgTable('widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
})
const createSchema = z.object({ name: z.string().min(1) })
const updateSchema = createSchema.partial()

const PROJECT_A = '11111111-1111-1111-1111-111111111111'
const ROW_IN_A = '22222222-2222-2222-2222-222222222222'

function req(body?: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

describe('createCrudHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const { GET } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await GET(req(), { params: Promise.resolve({ projectId: PROJECT_A }) })
    expect(res.status).toBe(401)
  })

  it('POST returns 400 on invalid body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const { POST } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await POST(req({ name: '' }), { params: Promise.resolve({ projectId: PROJECT_A }) })
    expect(res.status).toBe(400)
  })

  it('POST inserts with projectId from the URL, ignoring any projectId in the body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: ROW_IN_A, projectId: PROJECT_A, name: 'x' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const { POST } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    await POST(req({ name: 'x', projectId: 'attacker-project' }), { params: Promise.resolve({ projectId: PROJECT_A }) })
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'x', projectId: PROJECT_A }))
  })

  it('PATCH returns 404 when the row belongs to a different project', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([]) // no row matched the (id, projectId) filter
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    dbMock.update.mockReturnValue({ set })
    const { PATCH } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await PATCH(req({ name: 'y' }), { params: Promise.resolve({ projectId: PROJECT_A, id: ROW_IN_A }) })
    expect(res.status).toBe(404)
  })

  it('DELETE returns 204 when the row is deleted', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: ROW_IN_A }])
    const where = vi.fn().mockReturnValue({ returning })
    dbMock.delete.mockReturnValue({ where })
    const { DELETE } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await DELETE(req(), { params: Promise.resolve({ projectId: PROJECT_A, id: ROW_IN_A }) })
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/crud/createCrudHandlers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/crud/createCrudHandlers'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/crud/createCrudHandlers.ts
import { and, eq, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '@/db'
import { auth } from '@/lib/auth'

type AnyTable = {
  id: { name: string }
  projectId: { name: string }
} & Record<string, unknown>

type Params = { projectId: string; id?: string }

async function requireSession(req: Request): Promise<Response | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  return null
}

export function createCrudHandlers<TTable extends AnyTable>(config: {
  table: TTable
  createSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
}) {
  const { table, createSchema, updateSchema } = config

  return {
    async GET(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId } = await params
      // @ts-expect-error -- generic table shape, projectId column exists at runtime
      const rows = await db.query[table[Symbol.for('drizzle:Name')] as string]?.findMany?.({
        where: eq(table.projectId as never, projectId),
      }) ?? await db.select().from(table as never).where(eq(table.projectId as never, projectId))
      return Response.json(rows)
    },

    async POST(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId } = await params
      const body = await req.json()
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
      const [row] = await db.insert(table as never).values({
        ...parsed.data,
        projectId,
      } as never).returning()
      return Response.json(row, { status: 201 })
    },

    async PATCH(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId, id } = await params
      const body = await req.json()
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
      const filter = and(
        eq(table.id as never, id as string),
        eq(table.projectId as never, projectId),
      ) as SQL
      const [row] = await db.update(table as never)
        .set({ ...parsed.data, updatedAt: new Date() } as never)
        .where(filter)
        .returning()
      if (!row) return new Response('Not found', { status: 404 })
      return Response.json(row)
    },

    async DELETE(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId, id } = await params
      const filter = and(
        eq(table.id as never, id as string),
        eq(table.projectId as never, projectId),
      ) as SQL
      const [row] = await db.delete(table as never).where(filter).returning()
      if (!row) return new Response('Not found', { status: 404 })
      return new Response(null, { status: 204 })
    },
  }
}
```

> The `GET` handler's `db.query[...]` lookup is fragile against Drizzle's relational-query API naming. Simplify it in Step 3 to always use the query builder form, which every table supports uniformly:
> ```ts
> async GET(req: Request, { params }: { params: Promise<Params> }) {
>   const unauthorized = await requireSession(req)
>   if (unauthorized) return unauthorized
>   const { projectId } = await params
>   const rows = await db.select().from(table as never).where(eq(table.projectId as never, projectId))
>   return Response.json(rows)
> }
> ```
> Use this simplified version — drop the `db.query[...]` branch entirely.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/lib/crud/createCrudHandlers.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/crud/createCrudHandlers.ts test/lib/crud/createCrudHandlers.test.ts
git commit -m "feat(crud): generic server CRUD handler factory with project_id isolation"
```

---

## Task 5: Generic client RTK Query entity API factory

**Files:**
- Create: `store/apis/createEntityApi.ts`
- Test: `test/store/apis/createEntityApi.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function createEntityApi<T, TCreate, TUpdate>(config: {
    reducerPath: string
    tagType: string
    basePath: string // e.g. 'players' — full URL becomes /api/projects/{projectId}/{basePath}
  }): {
    api: ReturnType<typeof createApi>
    hooks: {
      useListQuery: (projectId: string) => ReturnType<...>
      useGetQuery: (args: { projectId: string; id: string }) => ReturnType<...>
      useCreateMutation: () => ReturnType<...>
      useUpdateMutation: () => ReturnType<...>
      useDeleteMutation: () => ReturnType<...>
    }
  }
  ```
  Consumed by Tasks 9–12 to build `playersApi`, `talentsApi`, `sponsorsApi`, `videosApi`, `assetsApi`.

- [ ] **Step 1: Write the failing test**

```ts
// test/store/apis/createEntityApi.test.ts
import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { createEntityApi } from '@/store/apis/createEntityApi'

type Widget = { id: string; projectId: string; name: string }

describe('createEntityApi', () => {
  it('builds list/get/create/update/delete endpoints with project-scoped tags', () => {
    const { api } = createEntityApi<Widget, { name: string }, { name?: string }>({
      reducerPath: 'widgetsApi',
      tagType: 'Widget',
      basePath: 'widgets',
    })
    expect(api.reducerPath).toBe('widgetsApi')
    expect(Object.keys(api.endpoints)).toEqual(
      expect.arrayContaining(['listWidgets', 'getWidget', 'createWidget', 'updateWidget', 'deleteWidget']),
    )
  })

  it('the list query resolves the correct URL', () => {
    const { api } = createEntityApi<Widget, { name: string }, { name?: string }>({
      reducerPath: 'widgetsApi',
      tagType: 'Widget',
      basePath: 'widgets',
    })
    const store = configureStore({
      reducer: { [api.reducerPath]: api.reducer },
      middleware: (gd) => gd().concat(api.middleware),
    })
    const args = (api.endpoints.listWidgets as { query: (arg: string) => unknown }).query('proj-1')
    expect(args).toBe('/projects/proj-1/widgets')
    expect(store.getState()[api.reducerPath]).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store/apis/createEntityApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// store/apis/createEntityApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export function createEntityApi<TRow, TCreate, TUpdate>(config: {
  reducerPath: string
  tagType: string
  basePath: string
}) {
  const { reducerPath, tagType, basePath } = config

  const api = createApi({
    reducerPath,
    baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
    tagTypes: [tagType],
    endpoints: (b) => ({
      [`list${cap(basePath)}`]: b.query<TRow[], string>({
        query: (projectId) => `/projects/${projectId}/${basePath}`,
        providesTags: (_r, _e, projectId) => [{ type: tagType, id: `LIST:${projectId}` }],
      }),
      [`get${singular(tagType)}`]: b.query<TRow, { projectId: string; id: string }>({
        query: ({ projectId, id }) => `/projects/${projectId}/${basePath}/${id}`,
        providesTags: (_r, _e, { id }) => [{ type: tagType, id }],
      }),
      [`create${singular(tagType)}`]: b.mutation<TRow, { projectId: string; data: TCreate }>({
        query: ({ projectId, data }) => ({ url: `/projects/${projectId}/${basePath}`, method: 'POST', body: data }),
        invalidatesTags: (_r, _e, { projectId }) => [{ type: tagType, id: `LIST:${projectId}` }],
      }),
      [`update${singular(tagType)}`]: b.mutation<TRow, { projectId: string; id: string; data: TUpdate }>({
        query: ({ projectId, id, data }) => ({ url: `/projects/${projectId}/${basePath}/${id}`, method: 'PATCH', body: data }),
        invalidatesTags: (_r, _e, { projectId, id }) => [{ type: tagType, id }, { type: tagType, id: `LIST:${projectId}` }],
      }),
      [`delete${singular(tagType)}`]: b.mutation<void, { projectId: string; id: string }>({
        query: ({ projectId, id }) => ({ url: `/projects/${projectId}/${basePath}/${id}`, method: 'DELETE' }),
        invalidatesTags: (_r, _e, { projectId, id }) => [{ type: tagType, id }, { type: tagType, id: `LIST:${projectId}` }],
      }),
    }),
  }) as ReturnType<typeof createApi> & {
    endpoints: Record<string, unknown>
  }

  return { api }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function singular(tagType: string) {
  return tagType // tagType is already singular by convention, e.g. 'Player', 'Widget'
}
```

> The computed-key `endpoints: (b) => ({ [\`list${cap(basePath)}\`]: ... })` pattern produces endpoint names like `listWidgets`/`getWidget`/`createWidget` matching the test. Each entity task (9–12) re-exports typed hooks by destructuring `api.useListWidgetsQuery` etc. with the entity's real name substituted for `Widget`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/store/apis/createEntityApi.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add store/apis/createEntityApi.ts test/store/apis/createEntityApi.test.ts
git commit -m "feat(store): generic RTK Query entity API factory with project-scoped tags"
```

---

## Task 6: Asset upload endpoint (Netlify Blobs)

**Files:**
- Create: `lib/assets/upload.ts`
- Create: `app/api/projects/[projectId]/assets/upload/route.ts`
- Create: `app/api/projects/[projectId]/assets/route.ts`
- Create: `app/api/projects/[projectId]/assets/[id]/route.ts`
- Create: `db/schemas/assets.ts`
- Test: `test/lib/assets/upload.test.ts`

**Interfaces:**
- Consumes: `createCrudHandlers` (Task 4), `assets` table (Task 3).
- Produces: `uploadAsset(projectId: string, file: File, kind: string): Promise<{ url: string; sizeBytes: number }>` — consumed only by the upload route in this task; `createAssetSchema`/`updateAssetSchema` — consumed by Task 8's `<AssetPickerField>`.

- [ ] **Step 1: Write the failing test**

```ts
// test/lib/assets/upload.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const setMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({ set: setMock }),
}))

const { uploadAsset } = await import('@/lib/assets/upload')

describe('uploadAsset', () => {
  it('stores the file bytes under a project-scoped key and returns a permanent URL', async () => {
    const file = new File(['hello'], 'logo.png', { type: 'image/png' })
    const result = await uploadAsset('proj-1', file, 'logo')
    expect(setMock).toHaveBeenCalled()
    const [key] = setMock.mock.calls[0]
    expect(key).toContain('proj-1')
    expect(result.url).toContain('proj-1')
    expect(result.sizeBytes).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/assets/upload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/assets/upload.ts`**

```ts
// lib/assets/upload.ts
import { getStore } from '@netlify/blobs'

export async function uploadAsset(projectId: string, file: File, kind: string) {
  const store = getStore('assets')
  const key = `${projectId}/${crypto.randomUUID()}-${file.name}`
  const bytes = await file.arrayBuffer()
  await store.set(key, bytes, { metadata: { mimeType: file.type, kind } })
  return {
    url: `/.netlify/blobs/assets/${key}`,
    sizeBytes: bytes.byteLength,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/lib/assets/upload.test.ts`
Expected: PASS

- [ ] **Step 5: Write `db/schemas/assets.ts`**

```ts
// db/schemas/assets.ts
import { z } from 'zod'

export const createAssetSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  url: z.string().min(1),
  kind: z.enum(['logo', 'photo', 'graphic', 'other']),
})
export const updateAssetSchema = createAssetSchema.partial()
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
```

- [ ] **Step 6: Write the thin CRUD routes**

```ts
// app/api/projects/[projectId]/assets/route.ts
import { assets } from '@/db/schema'
import { createAssetSchema, updateAssetSchema } from '@/db/schemas/assets'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: assets, createSchema: createAssetSchema, updateSchema: updateAssetSchema })
```

```ts
// app/api/projects/[projectId]/assets/[id]/route.ts
import { assets } from '@/db/schema'
import { createAssetSchema, updateAssetSchema } from '@/db/schemas/assets'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: assets, createSchema: createAssetSchema, updateSchema: updateAssetSchema })
```

- [ ] **Step 7: Write the upload route**

```ts
// app/api/projects/[projectId]/assets/upload/route.ts
import { db } from '@/db'
import { assets } from '@/db/schema'
import { auth } from '@/lib/auth'
import { uploadAsset } from '@/lib/assets/upload'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { projectId } = await params
  const formData = await req.formData()
  const file = formData.get('file')
  const kind = formData.get('kind')
  if (!(file instanceof File) || typeof kind !== 'string') {
    return Response.json({ error: 'file and kind are required' }, { status: 400 })
  }

  const { url, sizeBytes } = await uploadAsset(projectId, file, kind)
  const [row] = await db.insert(assets).values({
    projectId,
    filename: file.name,
    mimeType: file.type,
    sizeBytes,
    url,
    kind,
  }).returning()
  return Response.json(row, { status: 201 })
}
```

- [ ] **Step 8: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: all tests pass, including the new ones.

- [ ] **Step 9: Commit**

```bash
git add lib/assets/upload.ts db/schemas/assets.ts app/api/projects/\[projectId\]/assets/ test/lib/assets/upload.test.ts
git commit -m "feat(assets): Netlify Blobs upload endpoint and assets CRUD routes"
```

---

## Task 7: Client field widgets — `<AssetPickerField>` and `<ExtraMapField>`

**Files:**
- Create: `components/admin/crud/AssetPickerField.tsx`
- Create: `components/admin/crud/ExtraMapField.tsx`
- Test: `test/components/admin/crud/ExtraMapField.test.tsx`
- Test: `test/components/admin/crud/AssetPickerField.test.tsx`

**Interfaces:**
- Consumes: `useListAssetsQuery`, an upload mutation hook (both built in Task 8 from `assetsApi`, but this task stubs its own local upload call via `fetch` to keep the component self-contained — see Step on `AssetPickerField`).
- Produces: `<ExtraMapField value={Extra} onChange={(next: Extra) => void} />`, `<AssetPickerField projectId={string} value={string | null} onChange={(assetId: string | null) => void} kind={string} />` — consumed by `<CrudPage>` in Task 8 and by `<TeamRosterEditor>` in Task 10.

- [ ] **Step 1: Write the failing test for `ExtraMapField`**

```tsx
// test/components/admin/crud/ExtraMapField.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtraMapField } from '@/components/admin/crud/ExtraMapField'

describe('ExtraMapField', () => {
  it('renders one row per existing key/value pair', () => {
    render(<ExtraMapField value={{ jersey: '23' }} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('jersey')).toBeInTheDocument()
    expect(screen.getByDisplayValue('23')).toBeInTheDocument()
  })

  it('calls onChange with a new empty row when Add field is clicked', () => {
    const onChange = vi.fn()
    render(<ExtraMapField value={{}} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add field/i }))
    expect(onChange).toHaveBeenCalledWith({ '': '' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/admin/crud/ExtraMapField.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ExtraMapField`**

```tsx
// components/admin/crud/ExtraMapField.tsx
'use client'
import { Box, TextField, IconButton, Button, Stack } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Extra } from '@/db/schemas/shared'

export function ExtraMapField({ value, onChange }: { value: Extra; onChange: (next: Extra) => void }) {
  const entries = Object.entries(value)

  function updateRow(index: number, key: string, val: string) {
    const next: Extra = {}
    entries.forEach(([k, v], i) => {
      if (i === index) next[key] = val
      else next[k] = v
    })
    onChange(next)
  }

  function removeRow(index: number) {
    const next: Extra = {}
    entries.forEach(([k, v], i) => {
      if (i !== index) next[k] = v
    })
    onChange(next)
  }

  return (
    <Box>
      <Stack spacing={1}>
        {entries.map(([k, v], i) => (
          <Stack direction="row" spacing={1} key={i} alignItems="center">
            <TextField size="small" label="key" value={k} onChange={(e) => updateRow(i, e.target.value, v)} />
            <TextField size="small" label="value" value={v} onChange={(e) => updateRow(i, k, e.target.value)} />
            <IconButton aria-label="remove field" onClick={() => removeRow(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" onClick={() => onChange({ ...value, '': '' })} sx={{ mt: 1 }}>
        Add field
      </Button>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/components/admin/crud/ExtraMapField.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `AssetPickerField`**

```tsx
// test/components/admin/crud/AssetPickerField.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { assetsApi } from '@/store/apis/assetsApi'
import { AssetPickerField } from '@/components/admin/crud/AssetPickerField'

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (gd) => gd().concat(assetsApi.middleware),
  })
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('AssetPickerField', () => {
  it('renders a select control and an upload button', () => {
    renderWithStore(<AssetPickerField projectId="proj-1" value={null} onChange={vi.fn()} kind="logo" />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run test/components/admin/crud/AssetPickerField.test.tsx`
Expected: FAIL — `@/store/apis/assetsApi` and `@/components/admin/crud/AssetPickerField` don't exist yet. This is expected: `assetsApi` is built in Task 8. Skip running this test until Task 8 is complete — write the component now, but defer Steps 6–7 of this task until after Task 8's Step 3 exists. Note this dependency and move on to Step 7 below once `assetsApi` exists.

- [ ] **Step 7: Write `AssetPickerField`**

```tsx
// components/admin/crud/AssetPickerField.tsx
'use client'
import { useState } from 'react'
import { MenuItem, TextField, Button, Stack } from '@mui/material'
import { useListAssetsQuery } from '@/store/apis/assetsApi'

export function AssetPickerField({
  projectId, value, onChange, kind,
}: {
  projectId: string
  value: string | null
  onChange: (assetId: string | null) => void
  kind: string
}) {
  const { data: assets = [] } = useListAssetsQuery(projectId)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kind)
    const res = await fetch(`/api/projects/${projectId}/assets/upload`, { method: 'POST', body: formData })
    const row = await res.json()
    setUploading(false)
    onChange(row.id)
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        select
        size="small"
        label="Asset"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">None</MenuItem>
        {assets.map((a: { id: string; filename: string }) => (
          <MenuItem key={a.id} value={a.id}>{a.filename}</MenuItem>
        ))}
      </TextField>
      <Button component="label" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload'}
        <input type="file" hidden onChange={handleUpload} accept="image/*,video/*" />
      </Button>
    </Stack>
  )
}
```

- [ ] **Step 8: After Task 8 is complete, run the deferred test**

Run: `npx vitest run test/components/admin/crud/AssetPickerField.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/admin/crud/AssetPickerField.tsx components/admin/crud/ExtraMapField.tsx test/components/admin/crud/
git commit -m "feat(admin): AssetPickerField and ExtraMapField widgets"
```

---

## Task 8: Generic `<CrudPage>` component and `assetsApi`

**Files:**
- Create: `store/apis/assetsApi.ts`
- Create: `components/admin/crud/CrudPage.tsx`
- Create: `lib/entities/types.ts`
- Test: `test/components/admin/crud/CrudPage.test.tsx`

**Interfaces:**
- Consumes: `createEntityApi` (Task 5), `ExtraMapField`/`AssetPickerField` (Task 7).
- Produces:
  ```ts
  // lib/entities/types.ts
  type FieldDef = {
    name: string
    label: string
    widget: 'text' | 'textarea' | 'select' | 'asset-picker' | 'extra-map'
    options?: { value: string; label: string }[]
  }
  type EntityDef<TRow> = {
    entityName: string
    fields: FieldDef[]
    createSchema: import('zod').ZodTypeAny
    columns: { field: string; headerName: string }[]
  }
  ```
  `<CrudPage projectId={string} entityDef={EntityDef} api={ReturnType<typeof createEntityApi>['api']} />` — consumed by Tasks 9, 11, 12 (Players, Sponsors, Videos, Talents pages) and by Task 10 (Teams page, wrapping it).

- [ ] **Step 1: Write `store/apis/assetsApi.ts`**

```ts
// store/apis/assetsApi.ts
import { createEntityApi } from './createEntityApi'
import type { Asset } from '@/lib/entities/assets'
import type { CreateAssetInput, UpdateAssetInput } from '@/db/schemas/assets'

const { api } = createEntityApi<Asset, CreateAssetInput, UpdateAssetInput>({
  reducerPath: 'assetsApi',
  tagType: 'Asset',
  basePath: 'assets',
})

export const assetsApi = api
export const {
  useListAssetsQuery,
  useGetAssetQuery,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
} = api as typeof api & {
  useListAssetsQuery: (projectId: string) => { data?: Asset[] }
  useGetAssetQuery: (args: { projectId: string; id: string }) => { data?: Asset }
  useCreateAssetMutation: () => [(args: { projectId: string; data: CreateAssetInput }) => Promise<unknown>, unknown]
  useUpdateAssetMutation: () => [(args: { projectId: string; id: string; data: UpdateAssetInput }) => Promise<unknown>, unknown]
  useDeleteAssetMutation: () => [(args: { projectId: string; id: string }) => Promise<unknown>, unknown]
}
```

- [ ] **Step 2: Write `lib/entities/assets.ts` (the `Asset` row type + entity def)**

```ts
// lib/entities/assets.ts
import { createAssetSchema } from '@/db/schemas/assets'
import type { EntityDef } from './types'

export type Asset = {
  id: string
  projectId: string
  filename: string
  mimeType: string
  sizeBytes: number
  url: string
  kind: string
  createdAt: string
  updatedAt: string
}

export const assetsEntityDef: EntityDef<Asset> = {
  entityName: 'Asset',
  fields: [
    { name: 'filename', label: 'Filename', widget: 'text' },
    {
      name: 'kind',
      label: 'Kind',
      widget: 'select',
      options: [
        { value: 'logo', label: 'Logo' },
        { value: 'photo', label: 'Photo' },
        { value: 'graphic', label: 'Graphic' },
        { value: 'other', label: 'Other' },
      ],
    },
  ],
  createSchema: createAssetSchema,
  columns: [
    { field: 'filename', headerName: 'Filename' },
    { field: 'kind', headerName: 'Kind' },
    { field: 'sizeBytes', headerName: 'Size (bytes)' },
  ],
}
```

- [ ] **Step 3: Write `lib/entities/types.ts`**

```ts
// lib/entities/types.ts
import type { ZodTypeAny } from 'zod'

export type FieldDef = {
  name: string
  label: string
  widget: 'text' | 'textarea' | 'select' | 'asset-picker' | 'extra-map'
  options?: { value: string; label: string }[]
}

export type EntityDef<TRow> = {
  entityName: string
  fields: FieldDef[]
  createSchema: ZodTypeAny
  columns: { field: keyof TRow & string; headerName: string }[]
}
```

- [ ] **Step 4: Write the failing test for `<CrudPage>`**

```tsx
// test/components/admin/crud/CrudPage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { assetsApi } from '@/store/apis/assetsApi'
import { assetsEntityDef } from '@/lib/entities/assets'
import { CrudPage } from '@/components/admin/crud/CrudPage'

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (gd) => gd().concat(assetsApi.middleware),
  })
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('CrudPage', () => {
  it('renders an Add button for the entity', () => {
    renderWithStore(<CrudPage projectId="proj-1" entityDef={assetsEntityDef} api={assetsApi} />)
    expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run test/components/admin/crud/CrudPage.test.tsx`
Expected: FAIL — `@/components/admin/crud/CrudPage` doesn't exist.

- [ ] **Step 6: Write `<CrudPage>`**

```tsx
// components/admin/crud/CrudPage.tsx
'use client'
import { useState } from 'react'
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { EntityDef } from '@/lib/entities/types'
import { AssetPickerField } from './AssetPickerField'
import { ExtraMapField } from './ExtraMapField'

type EntityApi = {
  useListQuery?: never
} & Record<string, unknown>

export function CrudPage<TRow extends { id: string }>({
  projectId, entityDef, api,
}: {
  projectId: string
  entityDef: EntityDef<TRow>
  api: EntityApi
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TRow | null>(null)

  const listHookName = `useList${entityDef.entityName}sQuery`
  const createHookName = `useCreate${entityDef.entityName}Mutation`
  const updateHookName = `useUpdate${entityDef.entityName}Mutation`
  const deleteHookName = `useDelete${entityDef.entityName}Mutation`

  const useListQuery = api[listHookName] as (projectId: string) => { data?: TRow[] }
  const useCreateMutation = api[createHookName] as () => [(args: { projectId: string; data: unknown }) => Promise<unknown>, unknown]
  const useUpdateMutation = api[updateHookName] as () => [(args: { projectId: string; id: string; data: unknown }) => Promise<unknown>, unknown]
  const useDeleteMutation = api[deleteHookName] as () => [(args: { projectId: string; id: string }) => Promise<unknown>, unknown]

  const { data: rows = [] } = useListQuery(projectId)
  const [createRow] = useCreateMutation()
  const [updateRow] = useUpdateMutation()
  const [deleteRow] = useDeleteMutation()

  const { control, handleSubmit, reset } = useForm({ resolver: zodResolver(entityDef.createSchema) })

  function openCreate() {
    setEditing(null)
    reset({})
    setOpen(true)
  }

  function openEdit(row: TRow) {
    setEditing(row)
    reset(row)
    setOpen(true)
  }

  async function onSubmit(data: Record<string, unknown>) {
    if (editing) await updateRow({ projectId, id: editing.id, data })
    else await createRow({ projectId, data })
    setOpen(false)
  }

  const columns: GridColDef[] = [
    ...entityDef.columns.map((c) => ({ field: c.field, headerName: c.headerName, flex: 1 })),
    {
      field: '__actions',
      headerName: '',
      sortable: false,
      renderCell: (params) => (
        <>
          <Button size="small" onClick={() => openEdit(params.row as TRow)}>Edit</Button>
          <Button size="small" color="error" onClick={() => deleteRow({ projectId, id: (params.row as TRow).id })}>Delete</Button>
        </>
      ),
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{entityDef.entityName}s</Typography>
        <Button variant="contained" onClick={openCreate}>{`Add ${entityDef.entityName}`}</Button>
      </Box>
      <DataGrid rows={rows} columns={columns} getRowId={(r) => (r as TRow).id} autoHeight />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? `Edit ${entityDef.entityName}` : `Add ${entityDef.entityName}`}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entityDef.fields.map((field) => (
              <Controller
                key={field.name}
                name={field.name}
                control={control}
                render={({ field: rhf, fieldState }) => {
                  if (field.widget === 'select') {
                    return (
                      <TextField
                        select
                        label={field.label}
                        value={rhf.value ?? ''}
                        onChange={rhf.onChange}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      >
                        {field.options?.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                      </TextField>
                    )
                  }
                  if (field.widget === 'asset-picker') {
                    return <AssetPickerField projectId={projectId} value={rhf.value ?? null} onChange={rhf.onChange} kind="other" />
                  }
                  if (field.widget === 'extra-map') {
                    return <ExtraMapField value={rhf.value ?? {}} onChange={rhf.onChange} />
                  }
                  return (
                    <TextField
                      label={field.label}
                      value={rhf.value ?? ''}
                      onChange={rhf.onChange}
                      multiline={field.widget === 'textarea'}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )
                }}
              />
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run test/components/admin/crud/CrudPage.test.tsx`
Expected: PASS

- [ ] **Step 8: Go back and run the deferred `AssetPickerField` test from Task 7, Step 8**

Run: `npx vitest run test/components/admin/crud/AssetPickerField.test.tsx`
Expected: PASS

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add store/apis/assetsApi.ts lib/entities/assets.ts lib/entities/types.ts components/admin/crud/CrudPage.tsx test/components/admin/crud/CrudPage.test.tsx
git commit -m "feat(admin): generic CrudPage component and assetsApi"
```

---

## Task 9: Players, Talents, Sponsors, Videos — schema, routes, API slices, pages

**Files:**
- Create: `db/schemas/players.ts`, `db/schemas/talents.ts`, `db/schemas/sponsors.ts`, `db/schemas/videos.ts`
- Create: `app/api/projects/[projectId]/players/route.ts`, `.../players/[id]/route.ts` (and the same pair for `talents`, `sponsors`, `videos`)
- Create: `store/apis/playersApi.ts`, `talentsApi.ts`, `sponsorsApi.ts`, `videosApi.ts`
- Create: `lib/entities/players.ts`, `talents.ts`, `sponsors.ts`, `videos.ts`
- Create: `app/admin/[projectId]/data/players/page.tsx` (and the same for `talents`, `sponsors`, `videos`)
- Test: `test/db/schemas/players.test.ts` (representative — same shape for the other three, written in this task)

**Interfaces:**
- Consumes: `createCrudHandlers` (Task 4), `createEntityApi` (Task 5), `<CrudPage>` (Task 8), `players`/`talents`/`sponsors`/`videos` tables (Task 3).
- Produces: nothing consumed by later tasks — these are leaf pages. (Sponsors' `videoId` field references `videos.id`; Task 3 already declared both tables, so no ordering issue here.)

- [ ] **Step 1: Write the failing test for the Players Zod schema**

```ts
// test/db/schemas/players.test.ts
import { describe, it, expect } from 'vitest'
import { createPlayerSchema } from '@/db/schemas/players'

describe('createPlayerSchema', () => {
  it('accepts a minimal valid player', () => {
    const result = createPlayerSchema.parse({ name: 'Alex' })
    expect(result.name).toBe('Alex')
    expect(result.extra).toEqual({})
  })

  it('rejects a missing name', () => {
    expect(() => createPlayerSchema.parse({})).toThrow()
  })

  it('rejects a non-uuid avatarAssetId', () => {
    expect(() => createPlayerSchema.parse({ name: 'Alex', avatarAssetId: 'not-a-uuid' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db/schemas/players.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `db/schemas/players.ts`**

```ts
// db/schemas/players.ts
import { z } from 'zod'
import { extraSchema } from './shared'

export const createPlayerSchema = z.object({
  name: z.string().min(1).max(100),
  surname: z.string().max(100).optional(),
  nickname: z.string().max(100).optional(),
  avatarAssetId: z.string().uuid().optional(),
  imageAssetId: z.string().uuid().optional(),
  leftImageAssetId: z.string().uuid().optional(),
  rightImageAssetId: z.string().uuid().optional(),
  rosterAssetId: z.string().uuid().optional(),
  rosterLeftAssetId: z.string().uuid().optional(),
  rosterRightAssetId: z.string().uuid().optional(),
  extra: extraSchema,
})
export const updatePlayerSchema = createPlayerSchema.partial()
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db/schemas/players.test.ts`
Expected: PASS

- [ ] **Step 5: Write the same schema shape for Talents, Sponsors, Videos (no new test file — schema shape already proven by Players' tests; these are asserted via the route-level and entity-def wiring)**

```ts
// db/schemas/talents.ts
import { z } from 'zod'
import { extraSchema } from './shared'

export const createTalentSchema = z.object({
  name: z.string().min(1).max(100),
  surname: z.string().max(100).optional(),
  nickname: z.string().max(100).optional(),
  avatarAssetId: z.string().uuid().optional(),
  leftImageAssetId: z.string().uuid().optional(),
  rightImageAssetId: z.string().uuid().optional(),
  rosterAssetId: z.string().uuid().optional(),
  rosterLeftAssetId: z.string().uuid().optional(),
  rosterRightAssetId: z.string().uuid().optional(),
  extra: extraSchema,
})
export const updateTalentSchema = createTalentSchema.partial()
export type CreateTalentInput = z.infer<typeof createTalentSchema>
export type UpdateTalentInput = z.infer<typeof updateTalentSchema>
```

```ts
// db/schemas/sponsors.ts
import { z } from 'zod'

export const createSponsorSchema = z.object({
  name: z.string().min(1).max(120),
  position: z.string().max(60).optional(),
  imageAssetId: z.string().uuid().optional(),
  bigImageAssetId: z.string().uuid().optional(),
  videoId: z.string().uuid().optional(),
})
export const updateSponsorSchema = createSponsorSchema.partial()
export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>
```

```ts
// db/schemas/videos.ts
import { z } from 'zod'

export const createVideoSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  loop: z.boolean().default(false),
})
export const updateVideoSchema = createVideoSchema.partial()
export type CreateVideoInput = z.infer<typeof createVideoSchema>
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>
```

- [ ] **Step 6: Write the thin CRUD routes for all four entities**

```ts
// app/api/projects/[projectId]/players/route.ts
import { players } from '@/db/schema'
import { createPlayerSchema, updatePlayerSchema } from '@/db/schemas/players'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: players, createSchema: createPlayerSchema, updateSchema: updatePlayerSchema })
```

```ts
// app/api/projects/[projectId]/players/[id]/route.ts
import { players } from '@/db/schema'
import { createPlayerSchema, updatePlayerSchema } from '@/db/schemas/players'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: players, createSchema: createPlayerSchema, updateSchema: updatePlayerSchema })
```

Repeat the identical two-file pattern for `talents` (`app/api/projects/[projectId]/talents/route.ts` + `[id]/route.ts`, importing `talents` table and `createTalentSchema`/`updateTalentSchema`), `sponsors` (`sponsors` table, `createSponsorSchema`/`updateSponsorSchema`), and `videos` (`videos` table, `createVideoSchema`/`updateVideoSchema`).

- [ ] **Step 7: Write the RTK Query API slices**

```ts
// store/apis/playersApi.ts
import { createEntityApi } from './createEntityApi'
import type { Player } from '@/lib/entities/players'
import type { CreatePlayerInput, UpdatePlayerInput } from '@/db/schemas/players'

const { api } = createEntityApi<Player, CreatePlayerInput, UpdatePlayerInput>({
  reducerPath: 'playersApi',
  tagType: 'Player',
  basePath: 'players',
})
export const playersApi = api
```

Repeat for `talentsApi.ts` (`Talent`, `'talentsApi'`, `'Talent'`, `'talents'`), `sponsorsApi.ts` (`Sponsor`, `'sponsorsApi'`, `'Sponsor'`, `'sponsors'`), `videosApi.ts` (`Video`, `'videosApi'`, `'Video'`, `'videos'`).

- [ ] **Step 8: Write the entity defs**

```ts
// lib/entities/players.ts
import { createPlayerSchema } from '@/db/schemas/players'
import type { EntityDef } from './types'
import type { Extra } from '@/db/schemas/shared'

export type Player = {
  id: string
  projectId: string
  name: string
  surname: string | null
  nickname: string | null
  avatarAssetId: string | null
  imageAssetId: string | null
  leftImageAssetId: string | null
  rightImageAssetId: string | null
  rosterAssetId: string | null
  rosterLeftAssetId: string | null
  rosterRightAssetId: string | null
  extra: Extra
  createdAt: string
  updatedAt: string
}

export const playersEntityDef: EntityDef<Player> = {
  entityName: 'Player',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'surname', label: 'Surname', widget: 'text' },
    { name: 'nickname', label: 'Nickname', widget: 'text' },
    { name: 'avatarAssetId', label: 'Avatar', widget: 'asset-picker' },
    { name: 'imageAssetId', label: 'Image', widget: 'asset-picker' },
    { name: 'leftImageAssetId', label: 'Left Image', widget: 'asset-picker' },
    { name: 'rightImageAssetId', label: 'Right Image', widget: 'asset-picker' },
    { name: 'rosterAssetId', label: 'Roster Image', widget: 'asset-picker' },
    { name: 'rosterLeftAssetId', label: 'Roster Left Image', widget: 'asset-picker' },
    { name: 'rosterRightAssetId', label: 'Roster Right Image', widget: 'asset-picker' },
    { name: 'extra', label: 'Extra fields', widget: 'extra-map' },
  ],
  createSchema: createPlayerSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'surname', headerName: 'Surname' },
    { field: 'nickname', headerName: 'Nickname' },
  ],
}
```

Repeat the same file shape for `lib/entities/talents.ts` (drop `imageAssetId`, keep the other seven fields plus `extra`), `lib/entities/sponsors.ts` (`name`, `position` as text, `imageAssetId`/`bigImageAssetId` as asset-picker, `videoId` as asset-picker pointed at `kind="other"` — note: `videoId` picks from Videos, not Assets, so use a plain `select` widget populated from `useListVideosQuery` instead; adjust the field def to `{ name: 'videoId', label: 'Video', widget: 'select', options: [] }` and leave wiring real video options as a follow-up — flag this as a known gap, not a blocker, since Sponsors are still usable without a linked video), `lib/entities/videos.ts` (`name` text, `url` text, `durationMs` text — numeric input via plain text field is acceptable for MVP, `loop` — no boolean widget defined; render as `select` with `options: [{ value: 'true', label: 'Loop' }, { value: 'false', label: 'No loop' }]` and coerce in `onSubmit`... to avoid scope creep, keep `loop` as a `text` field accepting `"true"`/`"false"` for this pass).

- [ ] **Step 9: Write the admin pages**

```tsx
// app/admin/[projectId]/data/players/page.tsx
'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { playersApi } from '@/store/apis/playersApi'
import { playersEntityDef } from '@/lib/entities/players'

export default function PlayersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId} entityDef={playersEntityDef} api={playersApi} />
}
```

Repeat the identical shape for `talents/page.tsx`, `sponsors/page.tsx`, `videos/page.tsx`, substituting the matching api/entityDef imports.

- [ ] **Step 10: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (route files and pages have no dedicated unit tests — they're thin wiring already covered by Task 4/5/8's factory tests; verified manually in Task 16).

- [ ] **Step 11: Commit**

```bash
git add db/schemas/players.ts db/schemas/talents.ts db/schemas/sponsors.ts db/schemas/videos.ts \
        app/api/projects/\[projectId\]/players app/api/projects/\[projectId\]/talents \
        app/api/projects/\[projectId\]/sponsors app/api/projects/\[projectId\]/videos \
        store/apis/playersApi.ts store/apis/talentsApi.ts store/apis/sponsorsApi.ts store/apis/videosApi.ts \
        lib/entities/players.ts lib/entities/talents.ts lib/entities/sponsors.ts lib/entities/videos.ts \
        app/admin/\[projectId\]/data/players app/admin/\[projectId\]/data/talents \
        app/admin/\[projectId\]/data/sponsors app/admin/\[projectId\]/data/videos \
        test/db/schemas/players.test.ts
git commit -m "feat(admin): Players, Talents, Sponsors, Videos CRUD pages"
```

---

## Task 10: Teams — schema, roster transaction, roster editor UI

**Files:**
- Create: `db/schemas/teams.ts`
- Create: `app/api/projects/[projectId]/teams/route.ts`, `.../teams/[id]/route.ts`
- Create: `app/api/projects/[projectId]/teams/[id]/roster/route.ts`
- Create: `store/apis/teamsApi.ts`
- Create: `lib/entities/teams.ts`
- Create: `components/admin/crud/TeamRosterEditor.tsx`
- Create: `app/admin/[projectId]/data/teams/page.tsx`
- Test: `test/app/api/teams-roster.test.ts`

**Interfaces:**
- Consumes: `createCrudHandlers` (Task 4), `teams`/`teamPlayers`/`players` tables (Task 3), `<CrudPage>` (Task 8), `playersApi` (Task 9, for the roster dropdown options).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write `db/schemas/teams.ts`**

```ts
// db/schemas/teams.ts
import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().min(1).max(120),
  avatarAssetId: z.string().uuid().optional(),
  leftImageAssetId: z.string().uuid().optional(),
  rightImageAssetId: z.string().uuid().optional(),
  bigAvatarAssetId: z.string().uuid().optional(),
})
export const updateTeamSchema = createTeamSchema.partial()
export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>

export const rosterSlotSchema = z.object({
  playerId: z.string().uuid(),
  slot: z.number().int().nonnegative(),
  isCaptain: z.boolean().default(false),
  isStandIn: z.boolean().default(false),
})
export const replaceRosterSchema = z.object({
  slots: z.array(rosterSlotSchema).max(5),
})
export type ReplaceRosterInput = z.infer<typeof replaceRosterSchema>
```

- [ ] **Step 2: Write the failing test for the roster route**

```ts
// test/app/api/teams-roster.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const txMock = vi.fn()
const dbMock = { transaction: (fn: (tx: unknown) => unknown) => txMock(fn) }
vi.mock('@/db', () => ({ db: dbMock }))

const { PUT } = await import('@/app/api/projects/[projectId]/teams/[id]/roster/route')

const PROJECT_A = '11111111-1111-1111-1111-111111111111'
const TEAM_A = '22222222-2222-2222-2222-222222222222'

describe('PUT /teams/[id]/roster', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const req = new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify({ slots: [] }) })
    const res = await PUT(req, { params: Promise.resolve({ projectId: PROJECT_A, id: TEAM_A }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 with more than 5 slots', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const slots = Array.from({ length: 6 }, (_, i) => ({ playerId: '33333333-3333-3333-3333-333333333333', slot: i }))
    const req = new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify({ slots }) })
    const res = await PUT(req, { params: Promise.resolve({ projectId: PROJECT_A, id: TEAM_A }) })
    expect(res.status).toBe(400)
  })

  it('runs the replace inside a transaction on valid input', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    txMock.mockImplementation(async (fn) => {
      const tx = { delete: vi.fn(() => ({ where: vi.fn() })), insert: vi.fn(() => ({ values: vi.fn() })) }
      return fn(tx)
    })
    const slots = [{ playerId: '33333333-3333-3333-3333-333333333333', slot: 0, isCaptain: true, isStandIn: false }]
    const req = new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify({ slots }) })
    const res = await PUT(req, { params: Promise.resolve({ projectId: PROJECT_A, id: TEAM_A }) })
    expect(txMock).toHaveBeenCalled()
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/app/api/teams-roster.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 4: Write the roster route**

```ts
// app/api/projects/[projectId]/teams/[id]/roster/route.ts
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { teamPlayers } from '@/db/schema'
import { replaceRosterSchema } from '@/db/schemas/teams'
import { auth } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { projectId, id: teamId } = await params
  const body = await req.json()
  const parsed = replaceRosterSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  await db.transaction(async (tx) => {
    await tx.delete(teamPlayers).where(and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.projectId, projectId)))
    for (const slot of parsed.data.slots) {
      await tx.insert(teamPlayers).values({
        projectId,
        teamId,
        playerId: slot.playerId,
        slot: slot.slot,
        isCaptain: slot.isCaptain,
        isStandIn: slot.isStandIn,
      })
    }
  })

  return Response.json({ ok: true })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/app/api/teams-roster.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write the base Teams CRUD routes**

```ts
// app/api/projects/[projectId]/teams/route.ts
import { teams } from '@/db/schema'
import { createTeamSchema, updateTeamSchema } from '@/db/schemas/teams'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: teams, createSchema: createTeamSchema, updateSchema: updateTeamSchema })
```

```ts
// app/api/projects/[projectId]/teams/[id]/route.ts
import { teams } from '@/db/schema'
import { createTeamSchema, updateTeamSchema } from '@/db/schemas/teams'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: teams, createSchema: createTeamSchema, updateSchema: updateTeamSchema })
```

- [ ] **Step 7: Write `store/apis/teamsApi.ts`**

```ts
// store/apis/teamsApi.ts
import { createEntityApi } from './createEntityApi'
import type { Team } from '@/lib/entities/teams'
import type { CreateTeamInput, UpdateTeamInput, ReplaceRosterInput } from '@/db/schemas/teams'

const { api: baseApi } = createEntityApi<Team, CreateTeamInput, UpdateTeamInput>({
  reducerPath: 'teamsApi',
  tagType: 'Team',
  basePath: 'teams',
})

export const teamsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    replaceRoster: b.mutation<{ ok: true }, { projectId: string; teamId: string; data: ReplaceRosterInput }>({
      query: ({ projectId, teamId, data }) => ({
        url: `/projects/${projectId}/teams/${teamId}/roster`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'Team', id: teamId }],
    }),
  }),
})

export const { useReplaceRosterMutation } = teamsApi
```

- [ ] **Step 8: Write `lib/entities/teams.ts`**

```ts
// lib/entities/teams.ts
import { createTeamSchema } from '@/db/schemas/teams'
import type { EntityDef } from './types'

export type Team = {
  id: string
  projectId: string
  name: string
  avatarAssetId: string | null
  leftImageAssetId: string | null
  rightImageAssetId: string | null
  bigAvatarAssetId: string | null
  createdAt: string
  updatedAt: string
}

export const teamsEntityDef: EntityDef<Team> = {
  entityName: 'Team',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'avatarAssetId', label: 'Avatar', widget: 'asset-picker' },
    { name: 'leftImageAssetId', label: 'Left Image', widget: 'asset-picker' },
    { name: 'rightImageAssetId', label: 'Right Image', widget: 'asset-picker' },
    { name: 'bigAvatarAssetId', label: 'Big Avatar', widget: 'asset-picker' },
  ],
  createSchema: createTeamSchema,
  columns: [{ field: 'name', headerName: 'Name' }],
}
```

- [ ] **Step 9: Write `<TeamRosterEditor>`**

```tsx
// components/admin/crud/TeamRosterEditor.tsx
'use client'
import { useState } from 'react'
import { Box, MenuItem, TextField, Checkbox, FormControlLabel, Button, Stack, Typography } from '@mui/material'
import { useListPlayersQuery } from '@/store/apis/playersApi'
import { useReplaceRosterMutation } from '@/store/apis/teamsApi'

type Slot = { playerId: string; isCaptain: boolean; isStandIn: boolean }

export function TeamRosterEditor({ projectId, teamId }: { projectId: string; teamId: string }) {
  const { data: players = [] } = useListPlayersQuery(projectId)
  const [replaceRoster] = useReplaceRosterMutation()
  const [slots, setSlots] = useState<(Slot | null)[]>([null, null, null, null, null])

  function updateSlot(index: number, patch: Partial<Slot>) {
    setSlots((prev) => {
      const next = [...prev]
      next[index] = { playerId: '', isCaptain: false, isStandIn: false, ...next[index], ...patch }
      return next
    })
  }

  async function save() {
    const data = {
      slots: slots
        .map((s, i) => (s?.playerId ? { playerId: s.playerId, slot: i, isCaptain: s.isCaptain, isStandIn: s.isStandIn } : null))
        .filter((s): s is NonNullable<typeof s> => s !== null),
    }
    await replaceRoster({ projectId, teamId, data })
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Roster</Typography>
      <Stack spacing={1}>
        {slots.map((slot, i) => (
          <Stack direction="row" spacing={1} alignItems="center" key={i}>
            <TextField
              select
              size="small"
              label={`Slot ${i + 1}`}
              value={slot?.playerId ?? ''}
              onChange={(e) => updateSlot(i, { playerId: e.target.value })}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Empty</MenuItem>
              {players.map((p: { id: string; name: string }) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={slot?.isCaptain ?? false} onChange={(e) => updateSlot(i, { isCaptain: e.target.checked })} />}
              label="Captain"
            />
            <FormControlLabel
              control={<Checkbox checked={slot?.isStandIn ?? false} onChange={(e) => updateSlot(i, { isStandIn: e.target.checked })} />}
              label="Stand-in"
            />
          </Stack>
        ))}
      </Stack>
      <Button variant="outlined" onClick={save} sx={{ mt: 2 }}>Save Roster</Button>
    </Box>
  )
}
```

- [ ] **Step 10: Write the Teams page combining `<CrudPage>` and `<TeamRosterEditor>`**

```tsx
// app/admin/[projectId]/data/teams/page.tsx
'use client'
import { use, useState } from 'react'
import { Box, Divider } from '@mui/material'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { TeamRosterEditor } from '@/components/admin/crud/TeamRosterEditor'
import { teamsApi } from '@/store/apis/teamsApi'
import { teamsEntityDef } from '@/lib/entities/teams'
import { useListTeamsQuery } from '@/store/apis/teamsApi'

export default function TeamsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const { data: teams = [] } = useListTeamsQuery(projectId)

  return (
    <Box>
      <CrudPage projectId={projectId} entityDef={teamsEntityDef} api={teamsApi} />
      <Divider sx={{ my: 3 }} />
      {teams.length > 0 && (
        <Box>
          <select onChange={(e) => setSelectedTeamId(e.target.value || null)} defaultValue="">
            <option value="">Select a team to edit its roster…</option>
            {teams.map((t: { id: string; name: string }) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {selectedTeamId && <TeamRosterEditor projectId={projectId} teamId={selectedTeamId} />}
        </Box>
      )}
    </Box>
  )
}
```

> `store/apis/teamsApi.ts` does not currently export `useListTeamsQuery` by name (Step 7 exports `teamsApi` and `useReplaceRosterMutation` only). Fix this before Step 10: `createEntityApi`'s computed-key endpoints (Task 5) are not auto-exported as named hooks the way Task 9's `playersApi` assumed either — go back to Task 5 Step 3 and confirm `createEntityApi` returns `{ api }` only, meaning **every** consumer (Tasks 8, 9, 10) must destructure hooks off the RTK-Query-generated `api.use<Name>Query`/`api.use<Name>Mutation` names directly, e.g. `export const { useListTeamsQuery, useGetTeamQuery, useCreateTeamMutation, useUpdateTeamMutation, useDeleteTeamMutation } = teamsApi` — add this named-export line to the bottom of **every** `store/apis/*Api.ts` file created in Tasks 8, 9, and 10 (assetsApi, playersApi, talentsApi, sponsorsApi, videosApi, teamsApi). Apply this correction retroactively to those files as part of this task's Step 10, then re-run each entity's tests to confirm nothing broke.

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add db/schemas/teams.ts app/api/projects/\[projectId\]/teams store/apis/teamsApi.ts store/apis/assetsApi.ts \
        store/apis/playersApi.ts store/apis/talentsApi.ts store/apis/sponsorsApi.ts store/apis/videosApi.ts \
        lib/entities/teams.ts components/admin/crud/TeamRosterEditor.tsx app/admin/\[projectId\]/data/teams \
        test/app/api/teams-roster.test.ts
git commit -m "feat(admin): Teams CRUD with transactional roster editor"
```

---

## Task 11: Brackets — generation, custom routes, custom UI

**Files:**
- Create: `lib/brackets/generate.ts`
- Create: `db/schemas/brackets.ts`
- Create: `app/api/projects/[projectId]/brackets/route.ts`
- Create: `app/api/projects/[projectId]/brackets/[id]/matches/[matchId]/route.ts`
- Create: `store/apis/bracketsApi.ts`
- Create: `app/admin/[projectId]/data/brackets/page.tsx`
- Create: `app/admin/[projectId]/data/brackets/[bracketId]/page.tsx`
- Test: `test/lib/brackets/generate.test.ts`

**Interfaces:**
- Consumes: `brackets` table (Task 3), `extraSchema` (Task 2), `auth`/`db`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test for bracket generation**

```ts
// test/lib/brackets/generate.test.ts
import { describe, it, expect } from 'vitest'
import { generateSingleElim } from '@/lib/brackets/generate'

describe('generateSingleElim', () => {
  it('4 participants -> 1 Semifinal round of 2 + 1 Final', () => {
    const rounds = generateSingleElim(4)
    expect(rounds.map((r) => r.name)).toEqual(['Semifinal', 'Final'])
    expect(rounds[0].matches).toHaveLength(2)
    expect(rounds[1].matches).toHaveLength(1)
  })

  it('8 participants -> Quarterfinal(4), Semifinal(2), Final(1)', () => {
    const rounds = generateSingleElim(8)
    expect(rounds.map((r) => r.name)).toEqual(['Quarterfinal', 'Semifinal', 'Final'])
    expect(rounds[0].matches).toHaveLength(4)
  })

  it('16 participants -> Round of 16(8), Quarterfinal(4), Semifinal(2), Final(1)', () => {
    const rounds = generateSingleElim(16)
    expect(rounds.map((r) => r.name)).toEqual(['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'])
  })

  it('every generated match starts empty and scheduled', () => {
    const rounds = generateSingleElim(2)
    const match = rounds[0].matches[0]
    expect(match.status).toBe('scheduled')
    expect(match.leftParticipantId).toBeNull()
    expect(match.rightParticipantId).toBeNull()
    expect(match.scoreLeft).toBe(0)
    expect(match.scoreRight).toBe(0)
    expect(match.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/brackets/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `db/schemas/brackets.ts`**

```ts
// db/schemas/brackets.ts
import { z } from 'zod'
import { extraSchema } from './shared'

export const bracketMatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scheduledAt: z.string().datetime().nullable(),
  leftParticipantId: z.string().uuid().nullable(),
  rightParticipantId: z.string().uuid().nullable(),
  scoreLeft: z.number().int().nonnegative().default(0),
  scoreRight: z.number().int().nonnegative().default(0),
  status: z.enum(['scheduled', 'active', 'finished']).default('scheduled'),
  matchType: z.enum(['bo1', 'bo2', 'bo3', 'bo4', 'bo5', 'bo6']).default('bo1'),
  placeholderLeft: z.string().default(''),
  placeholderRight: z.string().default(''),
  winnerId: z.string().uuid().nullable(),
  extra: extraSchema,
})

export const bracketRoundSchema = z.object({
  name: z.string(),
  matches: z.array(bracketMatchSchema),
})
export type BracketRound = z.infer<typeof bracketRoundSchema>
export type BracketMatch = z.infer<typeof bracketMatchSchema>

export const createBracketSchema = z.object({
  name: z.string().min(1),
  participantCount: z.number().int().refine((n) => n >= 2 && (n & (n - 1)) === 0, 'must be a power of 2'),
})

export const updateMatchSchema = bracketMatchSchema.omit({ id: true }).partial()
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>
```

- [ ] **Step 4: Write `lib/brackets/generate.ts`**

```ts
// lib/brackets/generate.ts
import type { BracketRound } from '@/db/schemas/brackets'

const ROUND_NAMES: Record<number, string> = {
  1: 'Final', 2: 'Semifinal', 4: 'Quarterfinal', 8: 'Round of 16', 16: 'Round of 32',
}

export function generateSingleElim(participantCount: number): BracketRound[] {
  const rounds: BracketRound[] = []
  let matchesInRound = participantCount / 2
  while (matchesInRound >= 1) {
    const label = ROUND_NAMES[matchesInRound] ?? `Round of ${matchesInRound * 2}`
    rounds.push({
      name: label,
      matches: Array.from({ length: matchesInRound }, (_, i) => ({
        id: crypto.randomUUID(),
        name: `${label} ${i + 1}`,
        scheduledAt: null,
        leftParticipantId: null,
        rightParticipantId: null,
        scoreLeft: 0,
        scoreRight: 0,
        status: 'scheduled' as const,
        matchType: 'bo1' as const,
        placeholderLeft: '',
        placeholderRight: '',
        winnerId: null,
        extra: {},
      })),
    })
    matchesInRound /= 2
  }
  return rounds
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/lib/brackets/generate.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write the brackets collection route (custom POST, not the generic factory)**

```ts
// app/api/projects/[projectId]/brackets/route.ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { brackets } from '@/db/schema'
import { createBracketSchema } from '@/db/schemas/brackets'
import { auth } from '@/lib/auth'
import { generateSingleElim } from '@/lib/brackets/generate'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const rows = await db.select().from(brackets).where(eq(brackets.projectId, projectId))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const body = await req.json()
  const parsed = createBracketSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const rounds = generateSingleElim(parsed.data.participantCount)
  const [row] = await db.insert(brackets).values({
    projectId,
    name: parsed.data.name,
    format: 'single-elim',
    participantCount: parsed.data.participantCount,
    rounds,
  }).returning()
  return Response.json(row, { status: 201 })
}
```

- [ ] **Step 7: Write the match-update route**

```ts
// app/api/projects/[projectId]/brackets/[id]/matches/[matchId]/route.ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { brackets } from '@/db/schema'
import { updateMatchSchema, type BracketRound } from '@/db/schemas/brackets'
import { auth } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string; matchId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId, id, matchId } = await params
  const body = await req.json()
  const parsed = updateMatchSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const [bracket] = await db.select().from(brackets)
    .where(and(eq(brackets.id, id), eq(brackets.projectId, projectId)))
  if (!bracket) return new Response('Not found', { status: 404 })

  const rounds = bracket.rounds as BracketRound[]
  let found = false
  const nextRounds = rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => {
      if (match.id !== matchId) return match
      found = true
      return { ...match, ...parsed.data }
    }),
  }))
  if (!found) return new Response('Match not found', { status: 404 })

  const [row] = await db.update(brackets)
    .set({ rounds: nextRounds, updatedAt: new Date() })
    .where(and(eq(brackets.id, id), eq(brackets.projectId, projectId)))
    .returning()
  return Response.json(row)
}
```

- [ ] **Step 8: Write `store/apis/bracketsApi.ts`**

```ts
// store/apis/bracketsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BracketRound, UpdateMatchInput } from '@/db/schemas/brackets'

export type Bracket = {
  id: string
  projectId: string
  name: string
  format: string
  participantCount: number
  rounds: BracketRound[]
  createdAt: string
  updatedAt: string
}

export const bracketsApi = createApi({
  reducerPath: 'bracketsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Bracket'],
  endpoints: (b) => ({
    listBrackets: b.query<Bracket[], string>({
      query: (projectId) => `/projects/${projectId}/brackets`,
      providesTags: (_r, _e, projectId) => [{ type: 'Bracket', id: `LIST:${projectId}` }],
    }),
    createBracket: b.mutation<Bracket, { projectId: string; data: { name: string; participantCount: number } }>({
      query: ({ projectId, data }) => ({ url: `/projects/${projectId}/brackets`, method: 'POST', body: data }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Bracket', id: `LIST:${projectId}` }],
    }),
    updateMatch: b.mutation<Bracket, { projectId: string; bracketId: string; matchId: string; data: UpdateMatchInput }>({
      query: ({ projectId, bracketId, matchId, data }) => ({
        url: `/projects/${projectId}/brackets/${bracketId}/matches/${matchId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Bracket', id: `LIST:${projectId}` }],
    }),
  }),
})

export const { useListBracketsQuery, useCreateBracketMutation, useUpdateMatchMutation } = bracketsApi
```

- [ ] **Step 9: Write the Brackets list + create page**

```tsx
// app/admin/[projectId]/data/brackets/page.tsx
'use client'
import { use, useState } from 'react'
import { use as useParams } from 'react'
import Link from 'next/link'
import { Box, Button, TextField, Typography, List, ListItemButton } from '@mui/material'
import { useListBracketsQuery, useCreateBracketMutation } from '@/store/apis/bracketsApi'

export default function BracketsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: brackets = [] } = useListBracketsQuery(projectId)
  const [createBracket] = useCreateBracketMutation()
  const [name, setName] = useState('')
  const [participantCount, setParticipantCount] = useState(4)

  async function handleCreate() {
    await createBracket({ projectId, data: { name, participantCount } })
    setName('')
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Brackets</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} size="small" />
        <TextField
          label="Participants"
          type="number"
          value={participantCount}
          onChange={(e) => setParticipantCount(Number(e.target.value))}
          size="small"
        />
        <Button variant="contained" onClick={handleCreate}>Generate</Button>
      </Box>
      <List>
        {brackets.map((b) => (
          <ListItemButton key={b.id} component={Link} href={`/admin/${projectId}/data/brackets/${b.id}`}>
            {b.name} ({b.participantCount} participants)
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
```

Remove the unused duplicate `useParams` import in the file above — it is not needed; delete the line `import { use as useParams } from 'react'` before committing.

- [ ] **Step 10: Write the bracket detail/edit page**

```tsx
// app/admin/[projectId]/data/brackets/[bracketId]/page.tsx
'use client'
import { use } from 'react'
import { Box, Typography, TextField, MenuItem, Stack, Paper } from '@mui/material'
import { useListBracketsQuery, useUpdateMatchMutation } from '@/store/apis/bracketsApi'
import type { BracketMatch } from '@/db/schemas/brackets'

export default function BracketDetailPage({ params }: { params: Promise<{ projectId: string; bracketId: string }> }) {
  const { projectId, bracketId } = use(params)
  const { data: brackets = [] } = useListBracketsQuery(projectId)
  const [updateMatch] = useUpdateMatchMutation()
  const bracket = brackets.find((b) => b.id === bracketId)

  if (!bracket) return <Typography>Loading…</Typography>

  function patchMatch(matchId: string, data: Partial<BracketMatch>) {
    updateMatch({ projectId, bracketId, matchId, data })
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{bracket.name}</Typography>
      <Stack direction="row" spacing={3}>
        {bracket.rounds.map((round) => (
          <Box key={round.name}>
            <Typography variant="subtitle1">{round.name}</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {round.matches.map((match) => (
                <Paper key={match.id} sx={{ p: 2 }}>
                  <Typography variant="body2">{match.name}</Typography>
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={match.status}
                    onChange={(e) => patchMatch(match.id, { status: e.target.value as BracketMatch['status'] })}
                    sx={{ mt: 1, minWidth: 140 }}
                  >
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="finished">Finished</MenuItem>
                  </TextField>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      type="number"
                      label="Score L"
                      value={match.scoreLeft}
                      onChange={(e) => patchMatch(match.id, { scoreLeft: Number(e.target.value) })}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Score R"
                      value={match.scoreRight}
                      onChange={(e) => patchMatch(match.id, { scoreRight: Number(e.target.value) })}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add lib/brackets/generate.ts db/schemas/brackets.ts app/api/projects/\[projectId\]/brackets \
        store/apis/bracketsApi.ts app/admin/\[projectId\]/data/brackets test/lib/brackets/generate.test.ts
git commit -m "feat(admin): Brackets generation, custom routes, and match-editing UI"
```

---

## Task 12: Project CSS — single-row route and editor

**Files:**
- Create: `db/schemas/project-css.ts`
- Create: `lib/css/validate-no-remote-import.ts`
- Create: `app/api/projects/[projectId]/css/route.ts`
- Create: `store/apis/projectCssApi.ts`
- Create: `app/admin/[projectId]/data/css/page.tsx`
- Test: `test/lib/css/validate-no-remote-import.test.ts`

**Interfaces:**
- Consumes: `projectCss` table (Task 3), `auth`/`db`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test for the remote-import validator**

```ts
// test/lib/css/validate-no-remote-import.test.ts
import { describe, it, expect } from 'vitest'
import { validateNoRemoteImport } from '@/lib/css/validate-no-remote-import'

describe('validateNoRemoteImport', () => {
  it('accepts plain CSS with no @import', () => {
    expect(validateNoRemoteImport('.foo { color: red; }')).toBe(true)
  })

  it('rejects @import url(...) of a remote stylesheet', () => {
    expect(validateNoRemoteImport("@import url('https://evil.example/x.css');")).toBe(false)
  })

  it('rejects @import "..." (quoted form, no url())', () => {
    expect(validateNoRemoteImport('@import "https://evil.example/x.css";')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/css/validate-no-remote-import.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validator**

```ts
// lib/css/validate-no-remote-import.ts
export function validateNoRemoteImport(css: string): boolean {
  const importPattern = /@import\s+(url\(|["'])/i
  return !importPattern.test(css)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/lib/css/validate-no-remote-import.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write `db/schemas/project-css.ts`**

```ts
// db/schemas/project-css.ts
import { z } from 'zod'

export const updateProjectCssSchema = z.object({
  css: z.string().max(50_000),
})
export type UpdateProjectCssInput = z.infer<typeof updateProjectCssSchema>
```

- [ ] **Step 6: Write the single-row route**

```ts
// app/api/projects/[projectId]/css/route.ts
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projectCss } from '@/db/schema'
import { updateProjectCssSchema } from '@/db/schemas/project-css'
import { auth } from '@/lib/auth'
import { validateNoRemoteImport } from '@/lib/css/validate-no-remote-import'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const [row] = await db.select().from(projectCss).where(eq(projectCss.projectId, projectId))
  return Response.json(row ?? { projectId, css: '' })
}

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const body = await req.json()
  const parsed = updateProjectCssSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  if (!validateNoRemoteImport(parsed.data.css)) {
    return Response.json({ error: 'CSS may not @import a remote stylesheet' }, { status: 400 })
  }

  const [row] = await db.insert(projectCss)
    .values({ projectId, css: parsed.data.css })
    .onConflictDoUpdate({ target: projectCss.projectId, set: { css: parsed.data.css, updatedAt: new Date() } })
    .returning()
  return Response.json(row)
}
```

- [ ] **Step 7: Write `store/apis/projectCssApi.ts`**

```ts
// store/apis/projectCssApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const projectCssApi = createApi({
  reducerPath: 'projectCssApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['ProjectCss'],
  endpoints: (b) => ({
    getCss: b.query<{ projectId: string; css: string }, string>({
      query: (projectId) => `/projects/${projectId}/css`,
      providesTags: (_r, _e, projectId) => [{ type: 'ProjectCss', id: projectId }],
    }),
    updateCss: b.mutation<{ projectId: string; css: string }, { projectId: string; css: string }>({
      query: ({ projectId, css }) => ({ url: `/projects/${projectId}/css`, method: 'PUT', body: { css } }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectCss', id: projectId }],
    }),
  }),
})

export const { useGetCssQuery, useUpdateCssMutation } = projectCssApi
```

- [ ] **Step 8: Write the editor page**

```tsx
// app/admin/[projectId]/data/css/page.tsx
'use client'
import { use, useEffect, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useGetCssQuery, useUpdateCssMutation } from '@/store/apis/projectCssApi'

export default function ProjectCssPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data } = useGetCssQuery(projectId)
  const [updateCss, { isLoading }] = useUpdateCssMutation()
  const [css, setCss] = useState('')

  useEffect(() => {
    if (data) setCss(data.css)
  }, [data])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Project CSS</Typography>
      <TextField
        multiline
        minRows={16}
        fullWidth
        value={css}
        onChange={(e) => setCss(e.target.value)}
        sx={{ fontFamily: 'monospace' }}
      />
      <Button
        variant="contained"
        sx={{ mt: 2 }}
        disabled={isLoading}
        onClick={() => updateCss({ projectId, css })}
      >
        Save
      </Button>
    </Box>
  )
}
```

- [ ] **Step 9: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add db/schemas/project-css.ts lib/css/validate-no-remote-import.ts app/api/projects/\[projectId\]/css \
        store/apis/projectCssApi.ts app/admin/\[projectId\]/data/css test/lib/css/validate-no-remote-import.test.ts
git commit -m "feat(admin): Project CSS single-row editor with remote-import guard"
```

---

## Task 13: Wire the Redux store and admin Provider

**Files:**
- Create: `store/index.ts`
- Modify: `app/admin/layout.tsx` (create if it doesn't exist)
- Test: `test/store/store.test.ts` already exists (per `git status` — modify if needed, otherwise add assertions)

**Interfaces:**
- Consumes: every `*Api` created in Tasks 8–12, plus the existing `editorSlice` (referenced in `docs/state-management.md` — check `store/editorSlice.ts`, already present per the merged auth branch's `git status` diff).
- Produces: `store: Store`, `RootState`, `AppDispatch` — the root store, consumed by any future admin component needing `useSelector`/`useDispatch`.

- [ ] **Step 1: Check the existing `editorSlice` location and export shape**

Run: `cat store/editorSlice.ts`

Confirm the slice's export name (e.g. `editorSlice` or `editorReducer`) before wiring it into `configureStore` in Step 3 — use whatever is actually exported, don't assume the name from docs/state-management.md if the real file differs.

- [ ] **Step 2: Write/extend the store test**

```ts
// test/store/store.test.ts — add these cases to the existing file (read it first; do not overwrite unrelated assertions)
import { describe, it, expect } from 'vitest'
import { store } from '@/store'
import { assetsApi } from '@/store/apis/assetsApi'
import { playersApi } from '@/store/apis/playersApi'
import { talentsApi } from '@/store/apis/talentsApi'
import { teamsApi } from '@/store/apis/teamsApi'
import { sponsorsApi } from '@/store/apis/sponsorsApi'
import { videosApi } from '@/store/apis/videosApi'
import { bracketsApi } from '@/store/apis/bracketsApi'
import { projectCssApi } from '@/store/apis/projectCssApi'

describe('store — data entity APIs', () => {
  it('registers all 8 entity API reducers', () => {
    const state = store.getState()
    expect(state[assetsApi.reducerPath]).toBeDefined()
    expect(state[playersApi.reducerPath]).toBeDefined()
    expect(state[talentsApi.reducerPath]).toBeDefined()
    expect(state[teamsApi.reducerPath]).toBeDefined()
    expect(state[sponsorsApi.reducerPath]).toBeDefined()
    expect(state[videosApi.reducerPath]).toBeDefined()
    expect(state[bracketsApi.reducerPath]).toBeDefined()
    expect(state[projectCssApi.reducerPath]).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/store/store.test.ts`
Expected: FAIL — `@/store` doesn't export a wired store with these reducers yet (or `store/index.ts` doesn't exist — check first; if the merged auth branch already created a minimal `store/index.ts` with just `editorSlice`, extend it instead of overwriting).

- [ ] **Step 4: Write/extend `store/index.ts`**

```ts
// store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { assetsApi } from './apis/assetsApi'
import { playersApi } from './apis/playersApi'
import { talentsApi } from './apis/talentsApi'
import { teamsApi } from './apis/teamsApi'
import { sponsorsApi } from './apis/sponsorsApi'
import { videosApi } from './apis/videosApi'
import { bracketsApi } from './apis/bracketsApi'
import { projectCssApi } from './apis/projectCssApi'
import { editorSlice } from './editorSlice' // adjust path/name per Step 1's findings

export const store = configureStore({
  reducer: {
    [assetsApi.reducerPath]: assetsApi.reducer,
    [playersApi.reducerPath]: playersApi.reducer,
    [talentsApi.reducerPath]: talentsApi.reducer,
    [teamsApi.reducerPath]: teamsApi.reducer,
    [sponsorsApi.reducerPath]: sponsorsApi.reducer,
    [videosApi.reducerPath]: videosApi.reducer,
    [bracketsApi.reducerPath]: bracketsApi.reducer,
    [projectCssApi.reducerPath]: projectCssApi.reducer,
    editor: editorSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(
    assetsApi.middleware,
    playersApi.middleware,
    talentsApi.middleware,
    teamsApi.middleware,
    sponsorsApi.middleware,
    videosApi.middleware,
    bracketsApi.middleware,
    projectCssApi.middleware,
  ),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/store/store.test.ts`
Expected: PASS

- [ ] **Step 6: Add the Redux `<Provider>` to the admin layout**

Check whether `app/admin/layout.tsx` already exists (it may not — the current admin tree only has `app/admin/page.tsx`). If it doesn't exist, create it:

```tsx
// app/admin/layout.tsx
'use client'
import { Provider } from 'react-redux'
import { store } from '@/store'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>
}
```

If it already exists (check first — do not blindly overwrite), add the `<Provider store={store}>` wrapper around its existing children instead of replacing the file.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add store/index.ts app/admin/layout.tsx test/store/store.test.ts
git commit -m "feat(admin): wire all entity API slices into the Redux store"
```

---

## Task 14: Data hub page and manual verification

**Files:**
- Create: `app/admin/[projectId]/data/page.tsx`
- Modify: `docs/getting-started.md` (append the `netlify dev` local-dev note)

**Interfaces:**
- Consumes: `SEED_PROJECT_ID` (`db/constants.ts`).
- Produces: nothing — this is the final integration task.

- [ ] **Step 1: Write the Data hub page**

```tsx
// app/admin/[projectId]/data/page.tsx
import { use } from 'react'
import Link from 'next/link'
import { Box, Typography, List, ListItemButton, ListItemText } from '@mui/material'

const SECTIONS = [
  { slug: 'players', label: 'Players' },
  { slug: 'talents', label: 'Talents' },
  { slug: 'teams', label: 'Teams' },
  { slug: 'sponsors', label: 'Sponsors' },
  { slug: 'videos', label: 'Videos' },
  { slug: 'assets', label: 'Assets' },
  { slug: 'brackets', label: 'Brackets' },
  { slug: 'css', label: 'Project CSS' },
]

export default function DataHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>Data</Typography>
      <List>
        {SECTIONS.map((s) => (
          <ListItemButton key={s.slug} component={Link} href={`/admin/${projectId}/data/${s.slug}`}>
            <ListItemText primary={s.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
```

- [ ] **Step 2: Append the local-dev note to `docs/getting-started.md`**

Read the file first, then append a new section at the end:

```markdown

## Working on asset-related features

Any work touching Project Assets, or any entity with an image/video field (Players, Talents, Teams, Sponsors), needs Netlify Blobs, which only works under `netlify dev` — not plain `next dev`. Run:

\`\`\`bash
npx netlify dev
\`\`\`

instead of `npm run dev` when working in this area. Everything else in the app works the same either way.
```

- [ ] **Step 3: Run the full test suite one last time**

Run: `npx vitest run`
Expected: all tests pass, zero regressions across the whole suite.

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0. Fix any type errors surfaced by the generic `<CrudPage>`'s use of `as never`/dynamic hook lookups before proceeding — these are the highest-risk spots for type drift introduced across Tasks 8–10.

- [ ] **Step 5: Manual smoke test via `netlify dev`**

Run: `npx netlify dev`

With the dev server running, visit each of these URLs (substitute the real value of `SEED_PROJECT_ID`, `'00000000-0000-0000-0000-000000000001'`) and confirm each page loads without a console error and its Add button opens a working dialog:

- `http://localhost:3000/admin/00000000-0000-0000-0000-000000000001/data`
- `.../data/players`, `.../data/talents`, `.../data/teams`, `.../data/sponsors`, `.../data/videos`, `.../data/assets`
- `.../data/brackets` — create a bracket with `participantCount: 4`, confirm it generates 2 Semifinal + 1 Final matches, click into it, change a match's status and score
- `.../data/css` — type some CSS, save, reload, confirm it persisted

Report any failures found during this pass before considering the task complete.

- [ ] **Step 6: Commit**

```bash
git add app/admin/\[projectId\]/data/page.tsx docs/getting-started.md
git commit -m "feat(admin): Data section hub page; document netlify dev requirement"
```

---

## Plan self-review notes

- **Spec coverage:** all 8 entities (Section 1–7 of the design doc) have a task. Asset upload strategy (Netlify Blobs) — Task 6. Generic server/client CRUD — Tasks 4, 5, 8. Teams roster — Task 10. Brackets generation + custom UI — Task 11. Project CSS + remote-import guard — Task 12. State management wiring — Task 13. No project gallery — correctly out of scope, confirmed no task builds one.
- **Known follow-ups flagged inline, not silently dropped:** Sponsors' `videoId` field renders as an empty-options `select` pending real Videos-list wiring (Task 9 Step 8); Videos' `loop` boolean renders as a text `"true"/"false"` field pending a dedicated boolean widget. Both are explicitly named as accepted MVP gaps, not silent omissions — revisit if the Videos/Sponsors pages need to be fully polished before this ships to an operator.
- **Type consistency:** `createEntityApi` (Task 5) returns `{ api }` only — Task 10's Step 10 catches and corrects the assumption (made in Task 9) that named hooks are auto-exported, and retroactively fixes every `store/apis/*Api.ts` file. Flagged explicitly rather than left as a silent inconsistency between tasks.
