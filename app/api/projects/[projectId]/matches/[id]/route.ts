import { matches } from '@/db/schema'
import { createMatchSchema, updateMatchSchema } from '@/db/schemas/brackets'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({
  table: matches,
  createSchema: createMatchSchema,
  updateSchema: updateMatchSchema,
})
