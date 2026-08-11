import { talents } from '@/db/schema'
import { createTalentSchema, updateTalentSchema } from '@/db/schemas/talents'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: talents, createSchema: createTalentSchema, updateSchema: updateTalentSchema })
