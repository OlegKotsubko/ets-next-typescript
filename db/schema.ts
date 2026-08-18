import {
  pgEnum, pgTable, serial, integer, text, date, timestamp, jsonb, boolean,
  doublePrecision, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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

// --- Disciplines / tags (a shared, GLOBAL vocabulary — not project-scoped) ---
export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
})

// --- Tournaments (a "project") + labels + favourites -----------------------
export const tournamentStatus = pgEnum('tournament_status', ['draft', 'upcoming', 'ongoing', 'ended'])

// The workspace calls this the "project"; the URL param is [projectId]. A
// project IS a tournament (absorbed from the tournament-management-service).
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  heroSectionUrl: text('hero_section_url'), // hero_section — logo / key art URL
  status: tournamentStatus('status').notNull().default('draft'),
  disciplineId: integer('discipline_id').references(() => tags.id), // discipline = a tag
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

// --- Players ----------------------------------------------------------------
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

// --- Teams ------------------------------------------------------------------
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

// --- Talents ----------------------------------------------------------------
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

// --- Videos (declared before sponsors for the FK) ---------------------------
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

// --- Sponsors ---------------------------------------------------------------
export const sponsors = pgTable('sponsors', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  videoId: integer('video_id').references(() => videos.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('sponsors_project_idx').on(t.projectId)])

// --- Assets -----------------------------------------------------------------
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

// --- Themes -----------------------------------------------------------------
export const themes = pgTable('themes', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  colors: jsonb('colors').$type<{ name: string; code: string }[]>().notNull().default([]),
  assetIds: jsonb('asset_ids').$type<number[]>().notNull().default([]),
}, (t) => [index('themes_project_idx').on(t.projectId)])

// --- Brackets / matches / seatings ------------------------------------------
export const brackets = pgTable('brackets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  structure: jsonb('structure').$type<unknown>().notNull().default({}), // stored tree, not generated
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('brackets_project_idx').on(t.projectId)])

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  bracketId: integer('bracket_id').references(() => brackets.id, { onDelete: 'set null' }),
  participantLeftId: integer('participant_left_id'), // team or player id, per tournament discipline
  participantRightId: integer('participant_right_id'),
  scoreLeft: integer('score_left').notNull().default(0),
  scoreRight: integer('score_right').notNull().default(0),
  status: text('status').notNull().default('scheduled'), // scheduled | active | finished
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

// --- Rundowns (container; overlays/data land in a later broadcast pass) ------
export const rundowns = pgTable('rundowns', {
  id: serial('id').primaryKey(),
  // Public broadcast token: /air/[uuid] & /preview/[uuid] and the SSE bus are
  // addressed by this unguessable id (replaces the former displays.uuid).
  uuid: text('uuid').notNull().unique().default(sql`gen_random_uuid()`),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  image: text('image'), // uploaded cover image URL
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('rundowns_project_idx').on(t.projectId)])

// A placed overlay/title instance in a rundown. Authored widget values live
// inline in `data.widget` this pass; per-display rundown_overlay_data arrives
// with the broadcast pass.
export const rundownOverlays = pgTable('rundown_overlays', {
  id: serial('id').primaryKey(),
  rundownId: integer('rundown_id').notNull().references(() => rundowns.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), // denormalized
  model: text('model').notNull(), // kebab registry key
  category: text('category'),
  template: text('template'),
  widgetName: text('widget_name').notNull(),
  layer: integer('layer').notNull().default(1), // 1..7 z-order
  color: integer('color').notNull().default(1), // 1..7 UI tag color
  displayFilter: text('display_filter'), // '' | '1'..'10'
  previewImg: text('preview_img'),
  isFullscreen: boolean('is_fullscreen').notNull().default(false),
  hasNextButton: boolean('has_next_button').notNull().default(false),
  order: integer('order').notNull().default(0),
  inMixer: text('in_mixer'),
  outMixer: text('out_mixer'),
  innerMixer: text('inner_mixer'),
  inTransitionCutPoint: doublePrecision('in_transition_cut_point'),
  outTransitionCutPoint: doublePrecision('out_transition_cut_point'),
  backgroundVideo: text('background_video'),
  backgroundImage: text('background_image'),
  data: jsonb('data').$type<{ widget: Record<string, unknown> }>().notNull().default({ widget: {} }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('rundown_overlays_rundown_idx').on(t.rundownId, t.order)])
