import { matches } from '@/db/schema'
import { createMatchSchema, updateMatchSchema } from '@/db/schemas/brackets'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({
  table: matches,
  createSchema: createMatchSchema,
  updateSchema: updateMatchSchema,
})
