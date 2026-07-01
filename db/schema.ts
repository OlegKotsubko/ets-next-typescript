import { pgEnum, pgTable, uuid, text, date, timestamp } from 'drizzle-orm/pg-core'
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
