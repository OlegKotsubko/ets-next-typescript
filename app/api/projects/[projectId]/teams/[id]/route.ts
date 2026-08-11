import { teams } from '@/db/schema'
import { createTeamSchema, updateTeamSchema } from '@/db/schemas/teams'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: teams, createSchema: createTeamSchema, updateSchema: updateTeamSchema })
