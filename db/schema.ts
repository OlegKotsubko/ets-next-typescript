import {
  pgEnum, pgTable, uuid, text, date, timestamp, integer, jsonb, index, boolean, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { z } from 'zod'

export const projectMode = pgEnum('project_mode', ['team_vs_team', 'player_vs_player'])

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // project_name
  mode: projectMode('mode').notNull(), // project_mode
  label: text('label').notNull(), // project_label — overlay-package folder under projects/
  pictureUrl: text('picture_url'), // project_picture
  eventDate: date('event_date'), // project_date
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Operator-supplied fields only. The server never trusts an id/projectId from the body.
export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(['team_vs_team', 'player_vs_player']),
  label: z.string().min(1), // validated against the live projects/ scan at the API layer (P6)
  pictureUrl: z.string().url().optional(),
  eventDate: z.string().date().optional(), // yyyy-mm-dd
})

// --- better-auth core tables (drizzleAdapter usePlural: true) ---------------
// Column set matches better-auth 1.6's generated Drizzle schema. If better-auth
// is upgraded across a minor that changes its core schema, re-diff against
// `npx @better-auth/cli generate` output.

export const users = pgTable('users', {
  id: text('id').primaryKey(), // better-auth generates text ids
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [index('sessions_user_idx').on(t.userId)])

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(), // 'credential' for email+password
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'), // scrypt hash for email+password
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [index('accounts_user_idx').on(t.userId)])

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [index('verifications_identifier_idx').on(t.identifier)])

export const rundowns = pgTable('rundowns', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // better-auth user id. Kept when the user is deleted so the rundown survives.
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('rundowns_project_idx').on(t.projectId)])

export const rundownItems = pgTable('rundown_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  rundownId: uuid('rundown_id')
    .notNull()
    .references(() => rundowns.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id') // denormalized for direct project-scoped filtering
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  titleKey: text('title_key').notNull(), // folder under projects/<label>/titles/
  label: text('label'), // operator-facing display label (Add Template modal)
  position: integer('position').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(), // validated against the title's model.ts
}, (t) => [index('rundown_items_rundown_idx').on(t.rundownId, t.position)])

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
