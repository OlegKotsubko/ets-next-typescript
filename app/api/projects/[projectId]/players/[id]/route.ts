import { players } from '@/db/schema'
import { createPlayerSchema, updatePlayerSchema } from '@/db/schemas/players'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: players, createSchema: createPlayerSchema, updateSchema: updatePlayerSchema })
