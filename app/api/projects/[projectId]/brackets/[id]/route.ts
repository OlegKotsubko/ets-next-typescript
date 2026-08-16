import { brackets } from '@/db/schema'
import { createBracketSchema, updateBracketSchema } from '@/db/schemas/brackets'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({
  table: brackets,
  createSchema: createBracketSchema,
  updateSchema: updateBracketSchema,
})
