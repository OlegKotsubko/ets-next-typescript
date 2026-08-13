# Data Entities

The **Data** section of a project (one of the two workspace links — **Data** and **Overlays**) is CRUD for the entities below. All share the same patterns:

- One Drizzle table; every row carries `project_id uuid` (see [database.md](./database.md#multi-tenancy-the-project_id-fk-isolation-pattern)).
- One Zod schema per entity (used by the admin form and the API validator).
- One RTK Query API slice per entity (see [state-management.md](./state-management.md)).
- One REST route group: `GET/POST/PATCH/DELETE /api/projects/[projectId]/<entity>[/[id]]`.

`[projectId]` is the project **UUID** (projects are UI-created event instances now — see [projects-system.md](./projects-system.md)), not a folder slug.

## Entities at a glance

| Entity | Route prefix | RTK Query slice | Notes |
|---|---|---|---|
| Project Assets | `/api/projects/[projectId]/assets` | `assetsApi` | Uploaded media (photos, logos, mp4 clips). Referenced by every image/video field below. |
| Players | `/api/projects/[projectId]/players` | `playersApi` | Roster people; selected into Teams and bracket matches. |
| Talents | `/api/projects/[projectId]/talents` | `talentsApi` | Casters/hosts. Same shape as Player, three images instead of four. |
| Teams | `/api/projects/[projectId]/teams` | `teamsApi` | Contain Players via the `team_players` join. |
| Sponsors | `/api/projects/[projectId]/sponsors` | `sponsorsApi` | Duplicate names allowed. |
| Tournament Brackets | `/api/projects/[projectId]/brackets` | `bracketsApi` | Single-elimination, generated from a participant count. |
| Project CSS | `/api/projects/[projectId]/css` | `projectCssApi` | Operator-editable CSS layered on the package `project.css`. |
| Project Videos | `/api/projects/[projectId]/videos` | `videosApi` | Background/intro/stinger clips referenced by ID. |

Each entity gets the same Drizzle skeleton (`id uuid`, `project_id uuid`, `createdAt`, `updatedAt`) plus its specific fields. The sections below list only the specific fields.

## Two shared conventions

**Image / video fields are asset references.** Every `*_image`, `*_avatar`, `*_roster`, `*_video` field is stored as a nullable FK to `assets.id` (`... references(() => assets.id, { onDelete: 'set null' })`) — never a raw URL or embedded blob. The admin form renders an asset picker that uploads to / selects from Project Assets.

**`extra` is an open string-map.** Players, Talents, and bracket matches each have an `extra jsonb` column holding an arbitrary, unlimited set of `"key": "value"` string pairs the operator adds by hand. One reusable schema:

```ts
// db/schemas/shared.ts
import { z } from 'zod';

export const extraSchema = z.record(z.string().min(1), z.string()).default({});
export type Extra = z.infer<typeof extraSchema>;
```

Stored as `extra: jsonb('extra').$type<Extra>().notNull().default({})`. The admin form renders it as a repeatable two-input row ("key" / "value") with an **Add field** button and no cap.

## Project Assets

Uploaded media — logos, photos, sponsor marks, clips. Referenced by every image/video field on the other entities.

```ts
export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  url: text('url').notNull(),                       // permanent URL after upload
  kind: text('kind').notNull(),                     // 'logo' | 'photo' | 'graphic' | 'other'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('assets_project_idx').on(t.projectId) }));
```

### Upload strategy — DECIDE BEFORE BUILD

The MVP does not specify a storage backend. Three options:

1. **Netlify Blobs** (recommended for Netlify deploy): signed PUTs from the client, return the permanent URL. Lowest infrastructure.
2. **S3-compatible bucket** (Cloudflare R2, AWS S3, Backblaze B2): same pattern, more portable.
3. **Embed bytes directly in `assets.url` as a data URL**: only acceptable for tiny SVG logos. Not recommended for photos or video.

Pick one before implementing the Assets CRUD UI. The schema above doesn't change — only the upload endpoint differs.

## Players

```ts
export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                                                  // player_name
  surname: text('surname'),                                                      // player_surname
  nickname: text('nickname'),                                                    // player_nickname
  avatarAssetId: uuid('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),         // player_avatar
  imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),           // player_image
  leftImageAssetId: uuid('left_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),  // player_left_image
  rightImageAssetId: uuid('right_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),// player_right_image
  rosterAssetId: uuid('roster_asset_id').references(() => assets.id, { onDelete: 'set null' }),         // player_roster
  rosterLeftAssetId: uuid('roster_left_asset_id').references(() => assets.id, { onDelete: 'set null' }),// player_roster_left
  rosterRightAssetId: uuid('roster_right_asset_id').references(() => assets.id, { onDelete: 'set null' }),// player_roster_right
  extra: jsonb('extra').$type<Extra>().notNull().default({}),                    // unlimited "key":"value" pairs
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('players_project_idx').on(t.projectId) }));
```

```ts
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
});
```

> The `*_roster` fields are **roster-card images** — asset references like the other image fields, one per screen side (`roster`, `roster_left`, `roster_right`).

## Talents

Casters, hosts, analysts. **Identical to Player except it has three images** (`talent_avatar`, `talent_left_image`, `talent_right_image`) instead of four — there is no plain `talent_image`. It keeps the same roster fields and `extra`.

```ts
export const talents = pgTable('talents', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                                                  // talent_name
  surname: text('surname'),                                                      // talent_surname
  nickname: text('nickname'),                                                    // talent_nickname
  avatarAssetId: uuid('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),         // talent_avatar
  leftImageAssetId: uuid('left_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),  // talent_left_image
  rightImageAssetId: uuid('right_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),// talent_right_image
  rosterAssetId: uuid('roster_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterLeftAssetId: uuid('roster_left_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  rosterRightAssetId: uuid('roster_right_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  extra: jsonb('extra').$type<Extra>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('talents_project_idx').on(t.projectId) }));
```

## Teams

A team has four images and a roster of Players selected from the same project.

```ts
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  avatarAssetId: uuid('avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),          // team_avatar
  leftImageAssetId: uuid('left_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),   // team_left_image
  rightImageAssetId: uuid('right_image_asset_id').references(() => assets.id, { onDelete: 'set null' }), // team_right_image
  bigAvatarAssetId: uuid('big_avatar_asset_id').references(() => assets.id, { onDelete: 'set null' }),   // team_big_avatar
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('teams_project_idx').on(t.projectId) }));
```

### Team roster — the `team_players` join

A team contains Players through a join table. Each membership can be flagged **captain** or **stand-in**.

```ts
export const teamPlayers = pgTable('team_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),  // denormalized for direct filtering
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  slot: integer('slot').notNull(),                          // 0-based order within the team
  isCaptain: boolean('is_captain').notNull().default(false),
  isStandIn: boolean('is_stand_in').notNull().default(false),
}, (t) => ({
  byTeam: index('team_players_team_idx').on(t.teamId, t.slot),
  uniqueMember: uniqueIndex('team_players_unique').on(t.teamId, t.playerId),  // a player joins a team once
}));
```

**UI:** the team form renders **five player slots by default**, each a dropdown listing every Player in the project (create 3 players → the dropdown shows those 3), plus **captain** and **stand-in** checkboxes per slot. Five is just the default render count, not a schema cap — empty slots are saved as no row; add/remove rows freely. The write replaces the team's `team_players` rows in one transaction.

## Sponsors

```ts
export const sponsors = pgTable('sponsors', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                             // sponsor_name — NOT unique
  position: text('position'),                               // sponsor_position — placement / rank label
  imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),       // sponsor_image
  bigImageAssetId: uuid('big_image_asset_id').references(() => assets.id, { onDelete: 'set null' }),// sponsor_big_image
  videoId: uuid('video_id').references(() => videos.id, { onDelete: 'set null' }),                  // sponsor_video
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('sponsors_project_idx').on(t.projectId) }));
```

> **Duplicate names are allowed by design** — two sponsors can share `name`. Do **not** add a unique constraint on `(project_id, name)`. `sponsor_position` is a free-text placement/rank label.

## Tournament Brackets

MVP supports **single elimination only**. The operator gives a `participant_count`; the system **generates the empty round/match skeleton**. Each match holds two participants whose type follows the project's `mode`: **teams** when `project_mode = 'team_vs_team'`, **players** when `project_mode = 'player_vs_player'`.

```ts
export const brackets = pgTable('brackets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  format: text('format').notNull().default('single-elim'),  // only 'single-elim' in MVP
  participantCount: integer('participant_count').notNull(), // power of 2 (4, 8, 16, …)
  rounds: jsonb('rounds').$type<BracketRound[]>().notNull(), // generated; see below
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('brackets_project_idx').on(t.projectId) }));
```

### Match and round shape

A participant ID is a `players.id` **or** `teams.id` depending on the project's mode — the column is the same, the resolving table differs.

```ts
export const bracketMatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),                                  // match_name (e.g. 'Quarterfinal 1')
  scheduledAt: z.string().datetime().nullable(),     // match_date (date picker)
  leftParticipantId: z.string().uuid().nullable(),   // left_participant — player or team per project_mode
  rightParticipantId: z.string().uuid().nullable(),  // right_participant
  scoreLeft: z.number().int().nonnegative().default(0),   // score_left
  scoreRight: z.number().int().nonnegative().default(0),  // score_right
  status: z.enum(['scheduled', 'active', 'finished']).default('scheduled'),     // match_status
  matchType: z.enum(['bo1', 'bo2', 'bo3', 'bo4', 'bo5', 'bo6']).default('bo1'), // match_type (best of 1–6)
  placeholderLeft: z.string().default(''),           // placeholder_left — shown before a participant is assigned (e.g. 'Winner of QF1')
  placeholderRight: z.string().default(''),          // placeholder_right
  winnerId: z.string().uuid().nullable(),
  extra: extraSchema,                                // same open string-map as Players
});

export const bracketRoundSchema = z.object({
  name: z.string(),                                  // 'Quarterfinal' | 'Semifinal' | 'Final' | …
  matches: z.array(bracketMatchSchema),
});

export type BracketRound = z.infer<typeof bracketRoundSchema>;

export const createBracketSchema = z.object({
  name: z.string().min(1),
  participantCount: z.number().int().refine(n => n >= 2 && (n & (n - 1)) === 0, 'must be a power of 2'),
});
```

### Generation

POST `/api/projects/[projectId]/brackets` takes `{ name, participantCount }` and generates the skeleton server-side. Rounds are named by their match count, so the last round is always **Final**:

```ts
// lib/brackets/generate.ts
const ROUND_NAMES: Record<number, string> = {
  1: 'Final', 2: 'Semifinal', 4: 'Quarterfinal', 8: 'Round of 16', 16: 'Round of 32',
};

export function generateSingleElim(participantCount: number): BracketRound[] {
  const rounds: BracketRound[] = [];
  let matchesInRound = participantCount / 2;            // 8 participants → 4 first-round matches
  while (matchesInRound >= 1) {
    const label = ROUND_NAMES[matchesInRound] ?? `Round of ${matchesInRound * 2}`;
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
        status: 'scheduled',
        matchType: 'bo1',
        placeholderLeft: '',
        placeholderRight: '',
        winnerId: null,
        extra: {},
      })),
    });
    matchesInRound /= 2;
  }
  return rounds;
}
```

So **8 participants → 4 Quarterfinal + 2 Semifinal + 1 Final**, all empty. The operator then edits each match to assign participants, a `match_date`, scores (`score_left`/`score_right`), the `match_status` (`scheduled` → `active` → `finished`), the `match_type` (best of 1–6), per-side `placeholder` labels (shown before a participant is assigned, e.g. 'Winner of QF1'), and `extra` fields. Auto-advancing winners through rounds is **out of MVP** (brackets render read-only in overlays).

## Project CSS

Operator-editable CSS that **overlays** the package `project.css`. Useful for last-minute brand tweaks without redeploying.

```ts
export const projectCss = pgTable('project_css', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  css: text('css').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

One row per project. The `/preview` and `/air` layouts inject this CSS **after** the package `project.css` so it wins on cascade. See [preview-air.md](./preview-air.md).

> The CSS is operator-authored and rendered on the broadcast page. Don't allow `@import url(...)` of arbitrary external stylesheets; validate at write time to reject any rule that fetches remote resources.

## Project Videos

Video assets that overlays reference by ID (background loops, intro stingers, sponsor clips).

```ts
export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),                                   // permanent URL (see Assets upload strategy)
  durationMs: integer('duration_ms'),
  loop: boolean('loop').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ byProject: index('videos_project_idx').on(t.projectId) }));
```

Why a separate table from Assets? Videos carry duration/loop metadata that doesn't fit the generic Asset shape, and the UI is distinct (preview player, scrubber). Note: per-overlay **stingers and backgrounds** are package files chosen in an overlay's `settings.ts`, not Project Videos — see [titles-system.md](./titles-system.md).

## API route pattern

Every entity follows the same five Route Handlers. The example below is for Players; substitute table and schema names for other entities.

```ts
// app/api/projects/[projectId]/players/route.ts
import { db } from '@/db';
import { players } from '@/db/schema';
import { createPlayerSchema } from '@/db/schemas/players';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Response('Unauthorized', { status: 401 });
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  await requireSession();
  const rows = await db.query.players.findMany({ where: eq(players.projectId, params.projectId) });
  return Response.json(rows);
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  await requireSession();
  const body = await req.json();
  const parsed = createPlayerSchema.parse(body);                // throws ZodError if invalid
  const [row] = await db.insert(players).values({
    ...parsed,
    projectId: params.projectId,                                // URL is authoritative
  }).returning();
  return Response.json(row, { status: 201 });
}
```

```ts
// app/api/projects/[projectId]/players/[id]/route.ts
export async function PATCH(req, { params }) {
  await requireSession();
  const body = await req.json();
  const parsed = updatePlayerSchema.parse(body);                // partial of createPlayerSchema
  const [row] = await db
    .update(players)
    .set({ ...parsed, updatedAt: new Date() })
    .where(and(eq(players.id, params.id), eq(players.projectId, params.projectId)))
    .returning();
  if (!row) return new Response('Not found', { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req, { params }) {
  await requireSession();
  const [row] = await db
    .delete(players)
    .where(and(eq(players.id, params.id), eq(players.projectId, params.projectId)))
    .returning();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 204 });
}
```

Note the `and(eq(table.id, params.id), eq(table.projectId, params.projectId))` filter on every mutation — even if someone guesses an ID from another project, the query won't match.

## Admin UI conventions

Each entity gets a page under `/projects/[projectId]/data/<entity>`:

- **List view** — MUI `DataGrid` with sortable columns and row-level edit/delete actions.
- **Create / edit dialog** — MUI `Dialog` with form fields derived from the Zod schema.
- **Form validation** — Zod schema parsed in the submit handler; MUI `helperText` shows errors.
- **Asset fields** — render an asset picker (upload-or-select from Project Assets).
- **`extra` fields** — repeatable key/value rows with an **Add field** button, no cap (Players, Talents, bracket matches).

Boilerplate is small; consider a `<CrudPage entity={playersDef} />` component once the patterns stabilize. Don't over-abstract before MVP ships.
