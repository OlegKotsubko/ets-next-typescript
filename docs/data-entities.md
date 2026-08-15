# Data Entities

The **Data** section of a tournament is CRUD for the entities below. In the real system these live in shared **weplay microservices** (managed by the `react-backoffice` CMS) and are consumed by the ETS apps; the monolith **absorbs them as local `project_id`-scoped Postgres tables** with the same field shapes the frontend uses.

All entities share the patterns:

- One Drizzle table; every row carries `project_id` (the tournament — see [database.md](./database.md#multi-tenancy-the-project_id-fk-isolation-pattern)).
- One Zod schema per entity (admin form + API validator).
- One RTK Query slice per entity ([state-management.md](./state-management.md)).
- One REST group: `GET/POST/PATCH/DELETE /api/projects/[projectId]/<entity>[/[id]]`.

`[projectId]` is the **tournament id** (integer). See [database.md](./database.md#identity-model).

## Conventions

- **`socialLinks`** — every person/team entity carries social links. The operator edits a list of `{ type, link }` rows; they are stored as a `{ type: link }` map (`jsonb`). (This replaces the old open-ended `extra` string-map, which was invented; only Talents keep a small free-text `extra_text`.)
- **Images are URLs, sometimes typed.** Player and team images are multiple, distinguished by a **photo type**, so they live in child tables (`player_photos`, `team_logos`) rather than a fixed set of columns. Sponsor/talent images and the tournament hero image are single URL fields.
- **`discipline`** — a foreign key to a `tags` row (see [Tags / Disciplines](#tags--disciplines)); the same tag vocabulary tags tournaments and classifies players/teams.

## Players

Absorbed from `player-management-service`.

```ts
export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),                // required, ≤25
  firstName: text('first_name'),                       // ≤25
  lastName: text('last_name'),                         // ≤25
  country: text('country'),
  disciplineId: integer('discipline_id').references(() => tags.id),
  gameId: text('game_id'),                             // alphanumeric in-game id
  position: text('position'),
  role: text('role'),
  birthDate: date('birth_date'),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('players_project_idx').on(t.projectId)]);

// One player has many photos, keyed by type.
export const playerPhotoType = pgEnum('player_photo_type',
  ['avatar', 'left', 'right', 'roster', 'left_lg', 'right_lg', 'statistics']);

export const playerPhotos = pgTable('player_photos', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  photoType: playerPhotoType('photo_type').notNull(),
  url: text('url').notNull(),
}, (t) => [uniqueIndex('player_photos_unique').on(t.playerId, t.photoType)]);
```

```ts
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
});
```

## Teams

Absorbed from `team-management-service`. A team has logos (by type) and a roster (with captain / stand-in flags).

```ts
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                        // required, ≥2
  country: text('country'),
  region: text('region'),
  disciplineId: integer('discipline_id').references(() => tags.id),
  opendotaId: text('opendota_id'),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('teams_project_idx').on(t.projectId)]);

export const teamLogoType = pgEnum('team_logo_type', ['logo', 'ets_logo', 'ets_graphics']);

export const teamLogos = pgTable('team_logos', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  photoType: teamLogoType('photo_type').notNull(),
  url: text('url').notNull(),
});

export const teamPlayers = pgTable('team_players', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: integer('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  isCaptain: boolean('is_captain').notNull().default(false),
  isStandIn: boolean('is_stand_in').notNull().default(false),
}, (t) => [uniqueIndex('team_players_unique').on(t.teamId, t.playerId)]);
```

The team edit form fans out to team logos and roster members alongside the team row (mirroring the backoffice composite update).

## Talents

Casters / hosts / analysts, from `talent-management-service`: `{ nickname, socialLinks, extra: { extra_text } }` plus profile photos. Rendered by talent overlays (either flat `nickname_1..N` widget fields or a `talents: [...]` array).

## Sponsors

From `sponsor-management-service`: `{ name, logo (url), video }`. Duplicate names allowed. Rendered by sponsor / sponsor-video overlays.

## Tags / Disciplines

From `tag-management-service`. A tag is the discipline/label vocabulary: `{ id, name, ... }`. Tournaments reference a discipline tag and carry label tags; players and teams reference a discipline tag.

## Matches & Brackets

From `bracket-manager-service` and `tournament-grid-constructor`. Brackets are a **stored tree**, not generated from a participant count. A match holds two participants (team or player), scores, status, and a seating.

```ts
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  bracketId: integer('bracket_id').references(() => brackets.id, { onDelete: 'set null' }),
  participantLeftId: integer('participant_left_id'),   // team or player id, per tournament discipline
  participantRightId: integer('participant_right_id'),
  scoreLeft: integer('score_left').notNull().default(0),
  scoreRight: integer('score_right').notNull().default(0),
  status: text('status').notNull().default('scheduled'),  // scheduled | active | finished
  matchType: text('match_type').notNull().default('bo1'), // bo1..bo6
});

// Player seating per match — drives left/right arrangement and ATEM camera switching.
export const seatings = pgTable('seatings', {
  matchId: integer('match_id').primaryKey().references(() => matches.id, { onDelete: 'cascade' }),
  leftTeamId: integer('left_team_id'),
  rightTeamId: integer('right_team_id'),
  leftTeamPlayers: jsonb('left_team_players').$type<string[]>().notNull().default([]),
  rightTeamPlayers: jsonb('right_team_players').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(false),
});
```

The operator's **selected match** (with side-swap logic driven by `seating`) is what overlays render as `data.match` / `data.participants`.

## Themes

From `tournament-themes`. A theme is a set of colors + assets applied at runtime as CSS variables on the broadcast pages:

```ts
export const themes = pgTable('themes', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  colors: jsonb('colors').$type<{ name: string; code: string }[]>().notNull().default([]),
  assetIds: jsonb('asset_ids').$type<number[]>().notNull().default([]),
});
```

Exactly one theme per tournament is active; its `colors` become `--<name>` CSS variables written to `:root` on `/preview` and `/air`. See [projects-system.md](./projects-system.md#theming) — this replaces the old per-package `project.css`/font-folder pipeline.

## Assets & Videos

From `tournament-assets` and `tournament-videos`. Assets carry an `asset_type` (`decor` | `background`) and, for video assets, a `video_type` (`mixer` | `background`). Videos/mixers are the stinger and background-loop clips overlays reference.

## API route pattern

Every entity follows the same five Route Handlers (Players shown; substitute table + schema for others):

```ts
// app/api/projects/[projectId]/players/route.ts
export async function GET(_req, { params }) {
  await requireSession();
  const { projectId } = await params;
  return Response.json(await db.select().from(players).where(eq(players.projectId, projectId)));
}

export async function POST(req, { params }) {
  await requireSession();
  const { projectId } = await params;
  const parsed = createPlayerSchema.parse(await req.json());
  const [row] = await db.insert(players).values({ ...parsed, projectId }).returning();
  return Response.json(row, { status: 201 });
}
```

`PATCH`/`DELETE` (under `[id]`) always filter on `and(eq(table.id, id), eq(table.projectId, projectId))`, so an id guessed from another tournament never matches.

## Admin UI conventions

Each entity gets a page under `/projects/[projectId]/data/<entity>`:

- **List view** — MUI `DataGrid`, sortable, row edit/delete.
- **Create / edit dialog** — MUI `Dialog`, fields derived from the Zod schema (Formik-style in the etalon; React Hook Form + `zodResolver` in the monolith).
- **Social links** — repeatable `{ type, link }` rows.
- **Image fields** — upload / pick a URL; player/team images are typed (photo type).
