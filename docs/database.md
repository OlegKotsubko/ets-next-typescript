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

The real system (all three legacy projects) keys everything by **integer ids** — tournaments, players, teams, matches, rundowns, overlays, and displays are all integer-pk records from Django `BigAutoField`s or external microservice ids. The monolith **absorbs these entity services as local tables** and keeps integer primary keys to match.

The one exception is the **display**, which also carries a public **`uuid`** used to address its broadcast output (`/air/[uuid]`, `/preview/[uuid]`) — an unguessable share-link token separate from its integer pk.

> **Divergence note.** The P0–P5a scaffold used UUID primary keys and a UI-created "projects" model. This doc describes the **corrected** integer-id, tournament-based model (the etalon). Reconciling the built code to it is a follow-up.

## Schema groups

The full schema lives in `db/schema.ts`. Tables fall into five groups.

### 1. Auth (managed by better-auth)

`users`, `sessions`, `accounts`, `verifications` — better-auth's Drizzle adapter. Login is **username + password** (session cookie); there is no public sign-up. See [auth.md](./auth.md).

### 2. Tournaments (a "project") + favourites

A **project is a tournament** the operator enters — not something created in the UI. Absorbed from `tournament-management-service`.

```ts
export const tournamentStatus = pgEnum('tournament_status', ['draft', 'upcoming', 'ongoing', 'ended']);

// The workspace calls this the "project"; the URL param is [projectId].
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),                       // tournament id (integer, from TMS)
  title: text('title').notNull(),
  heroSectionUrl: text('hero_section_url'),            // hero_section — logo/key art URL
  status: tournamentStatus('status').notNull().default('draft'),
  disciplineId: integer('discipline_id').references(() => tags.id),  // discipline = a tag
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// A tournament may carry any number of label tags (labels: [tagId]).
export const projectTags = pgTable('project_tags', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.projectId, t.tagId] })]);

// Per-operator favourites (the /projects sidebar).
export const projectFavourites = pgTable('project_favourites', {
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] })]);
```

There is **no** `project_mode`, `project_label` (overlay-package folder), `pictureUrl`, or `eventDate` — those were invented. A tournament's `discipline` decides which overlays apply (see [titles-system.md](./titles-system.md)).

### 3. Entity tables (the Data section manages)

Absorbed from the weplay CRUD microservices. Every table carries `project_id` (the tournament) so it is scoped. Field shapes are the etalon's real shapes — see [data-entities.md](./data-entities.md) for the full per-entity reference. Tables: `players`, `player_photos`, `teams`, `team_logos`, `team_players`, `talents`, `sponsors`, `matches`, `seatings`, `brackets`, `tags` (disciplines), `themes`, `assets`, `videos`.

```ts
// representative — see data-entities.md for all fields
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
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}), // {type: link}
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('players_project_idx').on(t.projectId)]);
```

### 4. Displays + per-user settings

A **display** is a broadcast output device. Overlays are routed to displays by `display_filter`; the display's `uuid` is the public address for its `/air` and `/preview` pages.

```ts
export const displays = pgTable('displays', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                        // not unique
  uuid: uuid('uuid').defaultRandom().notNull().unique(),  // public broadcast address
});

export const settings = pgTable('settings', {         // one row per user
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayId: integer('display_id').references(() => displays.id, { onDelete: 'set null' }),  // currently selected
  timezone: text('timezone').notNull().default('Europe/Berlin'),
  delay: integer('delay').notNull().default(0),        // stream-delay seconds
  channel: text('channel'),
  timeFormat: integer('time_format').notNull().default(24),  // 24 | 12
  mixer: text('mixer'),                                // default stinger/mixer URL
  atemIpAddress: text('atem_ip_address'),              // Blackmagic ATEM switcher
  observer: integer('observer').notNull().default(1),
  isGuest: boolean('is_guest').notNull().default(false),
  rundownId: integer('rundown_id').references(() => rundowns.id, { onDelete: 'set null' }),
});
```

### 5. Rundowns → overlays → overlay data

The content tree (the monolith's direct ancestor is the Django `Rundown → RundownOverlay → RundownOverlayData`).

```ts
export const rundowns = pgTable('rundowns', {
  id: serial('id').primaryKey(),
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
  category: text('category'),                          // discipline dir
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

// Per (overlay, display, user) runtime state + rendered payload.
export const rundownOverlayData = pgTable('rundown_overlay_data', {
  id: serial('id').primaryKey(),
  overlayId: integer('overlay_id').notNull().references(() => rundownOverlays.id, { onDelete: 'cascade' }),
  displayId: integer('display_id').notNull().references(() => displays.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<{ widget: Record<string, unknown> } & Record<string, unknown>>().notNull().default({ widget: {} }),
  isPreview: boolean('is_preview').notNull().default(false),
  isAir: boolean('is_air').notNull().default(false),
});
```

`data.widget` holds the operator-edited field values (validated against the overlay's **widget schema** — see [titles-system.md](./titles-system.md)); the rest of `data` is the collected render payload (current match, participants, sponsors) assembled server-side at preview/air time. See [rundowns.md](./rundowns.md).

> **Implementation note (overlays pass).** The overlays pass ships `rundown_overlays` with an **inline `data` JSONB column** holding the *authored* `data.widget` values, and does **not** yet create `rundown_overlay_data`. The per-`(overlay, display, user)` `rundown_overlay_data` (with `is_preview`/`is_air`) arrives with the **broadcast pass**, seeded from the authored `rundown_overlays.data.widget`. The two-table split above is the target; the single authored copy is the current state.

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
- FK columns: `<entity>_id` (`project_id`, `rundown_id`, `display_id`).
- Indexes: `<table>_<columns>_idx`. Soft deletes: not used; rely on `ON DELETE CASCADE`.
