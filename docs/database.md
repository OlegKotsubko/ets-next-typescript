# Database

Postgres on **Neon**, accessed via **Drizzle ORM** using the `@neondatabase/serverless` HTTP driver (the only Postgres client that works inside serverless functions without exhausting connection pools).

## Connection

```ts
// db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

One `db` instance is fine for the whole app — the HTTP driver creates a fresh connection per query.

## Identity model

The real system (all three legacy projects) keys everything by **integer ids** — tournaments, players, teams, matches, rundowns, and overlays are all integer-pk records from Django `BigAutoField`s or external microservice ids. The monolith **absorbs these entity services as local tables** and keeps integer primary keys to match.

The one exception is the **rundown**, which also carries a public **`uuid`** used to address its broadcast output (`/air/[uuid]`, `/preview/[uuid]`) — an unguessable share-link token separate from its integer pk. (The etalon put this uuid on a separate `display` entity; the monolith addresses broadcast by the rundown itself — see §4.)

> **Divergence note.** The P0–P5a scaffold used UUID primary keys and a UI-created "projects" model. This doc describes the **corrected** integer-id, tournament-based model (the etalon). Reconciling the built code to it is a follow-up.

## Schema groups

The full schema lives in `db/schema.ts`. Tables fall into the groups below (§4 is broadcast addressing, not a table group — the rundown carries the public uuid).

### 1. Auth (managed by better-auth)

`users`, `sessions`, `accounts`, `verifications` — better-auth's Drizzle adapter. Login is **username + password** (session cookie); there is no public sign-up. See [auth.md](./auth.md).

### 2. Tournaments (a "project") + favourites

A **project is a tournament** the operator enters — not something created in the UI. Absorbed from `tournament-management-service`.

```ts
export const tournamentStatus = pgEnum('tournament_status', ['draft', 'upcoming', 'ongoing', 'ended']);

// The workspace calls this the "project"; the URL param is [projectId].
// Authored in-app: create/edit/delete from the gallery.
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),                       // tournament id (integer)
  title: text('title').notNull(),
  status: tournamentStatus('status').notNull().default('draft'),
  overlayPacks: text('overlay_packs').array().notNull().default(sql`'{}'::text[]`),  // pack (folder) names
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Per-operator favourites (the /projects sidebar).
export const projectFavourites = pgTable('project_favourites', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] })]);
```

There is **no** `project_mode`, `project_label`, `pictureUrl`, `eventDate`, hero image, or discipline. A tournament's **`overlayPacks`** (pack/folder names) decides which overlays apply — `category ∈ overlayPacks`, no `general` fallback (see [projects-system.md](./projects-system.md#which-overlays-a-tournament-can-use)). The `tags`/`project_tags` tables were removed.

### 3. Entity tables (the Data section manages)

Absorbed from the weplay CRUD microservices. Every table carries `project_id` (the tournament) so it is scoped. Field shapes are the etalon's real shapes — see [data-entities.md](./data-entities.md) for the full per-entity reference. Tables: `players`, `player_photos`, `teams`, `team_logos`, `team_players`, `talents`, `sponsors`, `matches`, `seatings`, `brackets`, `themes`, `assets`, `videos`.

```ts
// representative — see data-entities.md for all fields
export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  country: text('country'),
  gameId: text('game_id'),
  position: text('position'),
  role: text('role'),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}), // {type: link}
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('players_project_idx').on(t.projectId)]);
```

### 4. Rundown broadcast addressing

Broadcast output is addressed by the **rundown's public `uuid`** (a column on `rundowns`, see §5), not by a separate display entity. `/air/[uuid]` and `/preview/[uuid]` load that rundown's live composition; the SSE bus is keyed by `(rundownUuid, channel)`. Overlays still carry a **`display_filter`** so one rundown can feed several filtered browser sources via `?filter=N` (see [preview-air.md](./preview-air.md)).

> **Divergence from the etalon.** `ets-react-poc` models broadcast output as a `Display` entity (its own uuid; one tournament → many displays; an operator-selected active display, plus a per-user `settings` row holding that selection, timezone, delay, mixer, ATEM ip, `is_guest`, etc.). The monolith **removed the `displays` and `settings` tables** and addresses broadcast by the rundown itself. The etalon's `settings` fields (timezone / delay / channel / mixer / atem / observer / is_guest / rundown) are roadmap — see [roadmap.md](./roadmap.md).

### 5. Rundowns → overlays → overlay data

The content tree (the monolith's direct ancestor is the Django `Rundown → RundownOverlay → RundownOverlayData`).

```ts
export const rundowns = pgTable('rundowns', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique().default(sql`gen_random_uuid()`),  // public broadcast address (/air/[uuid], /preview/[uuid])
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  image: text('image'),                                // uploaded cover image URL
}, (t) => [index('rundowns_project_idx').on(t.projectId)]);

// A placed overlay/title instance.
export const rundownOverlays = pgTable('rundown_overlays', {
  id: serial('id').primaryKey(),
  rundownId: integer('rundown_id').notNull().references(() => rundowns.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), // denormalized
  model: text('model').notNull(),                      // kebab registry key (e.g. 'ggl-scoreboard')
  category: text('category'),                          // pack (top-level overlays/ folder)
  template: text('template'),                          // widget dir
  widgetName: text('widget_name').notNull(),           // operator-facing label
  layer: integer('layer').notNull().default(1),        // 1..7 — z-index
  color: integer('color').notNull().default(1),        // 1..7 — UI tag color
  displayFilter: text('display_filter'),               // '' | '1'..'10' — routes to filtered displays
  previewImg: text('preview_img'),
  isFullscreen: boolean('is_fullscreen').notNull().default(false),
  hasNextButton: boolean('has_next_button').notNull().default(false),
  order: integer('order').notNull().default(0),
  inMixer: text('in_mixer'),                           // stinger/transition webm URLs
  outMixer: text('out_mixer'),
  innerMixer: text('inner_mixer'),
  inTransitionCutPoint: doublePrecision('in_transition_cut_point'),
  outTransitionCutPoint: doublePrecision('out_transition_cut_point'),
  backgroundVideo: text('background_video'),
  backgroundImage: text('background_image'),
}, (t) => [index('rundown_overlays_rundown_idx').on(t.rundownId, t.order)]);

// Per-broadcast runtime overrides + rendered payload — DEFERRED (not built).
// Live broadcast state is currently transient in the in-process bus; authored
// widget values live inline on rundown_overlays.data.widget. When this table
// lands it is keyed per (overlay, user); the etalon's per-display dimension is
// dropped along with the display entity.
export const rundownOverlayData = pgTable('rundown_overlay_data', {
  id: serial('id').primaryKey(),
  overlayId: integer('overlay_id').notNull().references(() => rundownOverlays.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<{ widget: Record<string, unknown> } & Record<string, unknown>>().notNull().default({ widget: {} }),
  isPreview: boolean('is_preview').notNull().default(false),
  isAir: boolean('is_air').notNull().default(false),
});
```

Today, authored `data.widget` values live **inline on `rundown_overlays`** and are written back on stage / `live_update` (so edits survive a hide → re-show); the collected render payload (current match, participants, sponsors) and the `rundown_overlay_data` table above are **deferred**. `data.widget` is validated against the overlay's **widget schema** — see [titles-system.md](./titles-system.md) and [rundowns.md](./rundowns.md).

> **Implementation note.** `rundown_overlays` carries an **inline `data` JSONB column** holding the *authored* `data.widget` values, written back on stage / `live_update`. `rundown_overlay_data` is **not** created; live broadcast state (`is_preview`/`is_air`, the collected render payload) is transient in the in-process bus. The two-table split above is the deferred target; the single authored copy is the current state.

## Multi-tenancy: the `project_id` FK isolation pattern

The most important pattern in the codebase. **Read before adding any entity.**

1. **Every entity table has a `project_id` column** referencing the tournament (`projects.id`), `on delete cascade`.
2. **Every index that supports a query starts with `project_id`.**
3. **Every query filters by `project_id`.** There is no `getAllPlayers()` — only `getPlayersForProject(projectId)`.
4. **All entity routes live under `/api/projects/[projectId]/...`**, so the filter is structural, not a discipline to remember.
5. **The server derives `projectId` from the URL, never the request body** — a validated body cannot move a row between tournaments.

```ts
// app/api/projects/[projectId]/players/route.ts
export async function POST(req, { params }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { projectId } = await params;
  const parsed = createPlayerSchema.parse(await req.json());   // body MAY NOT contain projectId
  await db.insert(players).values({ ...parsed, projectId });   // URL is authoritative
  return new Response(null, { status: 201 });
}
```

## Migrations vs. entity data vs. overlays

| | `npm run db:migrate` | Entity CRUD (UI) | Add/edit an overlay |
|---|---|---|---|
| Affects | Schema (DDL) | Entity rows (DML) | Overlay registry (code) + `rundown_overlays.data` |
| When | Schema changes | Operator edits data | Developer ships an overlay; operator configures one |
| DB change | Yes (tracked migration) | Row insert/update | None for the registry; `data.widget` is JSONB |

Workflow for a schema change: edit `db/schema.ts` → `npm run db:generate` → commit the SQL → `npm run db:migrate` against the right `DATABASE_URL` (dev then prod, never inside `next build`). See [deployment.md](./deployment.md).

## Drizzle CLI

```bash
npm run db:generate    # diff schema.ts vs migrations/ → emit a new SQL file
npm run db:migrate     # apply pending migrations to $DATABASE_URL
npm run db:studio      # open Drizzle Studio
```

## Naming conventions

- Tables: `snake_case`, plural (`players`, `rundown_overlays`).
- Columns: `snake_case` in the DB; Drizzle maps to `camelCase` in TS.
- FK columns: `<entity>_id` (`project_id`, `rundown_id`, `overlay_id`).
- Indexes: `<table>_<columns>_idx`. Soft deletes: not used; rely on `ON DELETE CASCADE`.
