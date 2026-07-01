import {
  pgEnum, pgTable, uuid, text, date, timestamp, integer, jsonb, index,
} from 'drizzle-orm/pg-core'
import { z } from 'zod'

export const projectMode = pgEnum('project_mode', ['team_vs_team', 'player_vs_player'])

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),                 // project_name
  mode: projectMode('mode').notNull(),          // project_mode
  label: text('label').notNull(),               // project_label — overlay-package folder under projects/
  pictureUrl: text('picture_url'),              // project_picture
  eventDate: date('event_date'),                // project_date
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Operator-supplied fields only. The server never trusts an id/projectId from the body.
export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(['team_vs_team', 'player_vs_player']),
  label: z.string().min(1),                     // validated against the live projects/ scan at the API layer (P6)
  pictureUrl: z.string().url().optional(),
  eventDate: z.string().date().optional(),      // yyyy-mm-dd
})

export const rundowns = pgTable('rundowns', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // better-auth user id (text). No FK until the users table exists in P2.
  ownerId: text('owner_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  byProject: index('rundowns_project_idx').on(t.projectId),
}))

export const rundownItems = pgTable('rundown_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  rundownId: uuid('rundown_id')
    .notNull()
    .references(() => rundowns.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')                 // denormalized for direct project-scoped filtering
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  titleKey: text('title_key').notNull(),        // folder under projects/<label>/titles/
  label: text('label'),                         // operator-facing display label (Add Template modal)
  position: integer('position').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),  // validated against the title's model.ts
}, (t) => ({
  byRundown: index('rundown_items_rundown_idx').on(t.rundownId, t.position),
}))
