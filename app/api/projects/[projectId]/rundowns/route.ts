import { rundowns } from '@/db/schema'
import { createRundownSchema, updateRundownSchema } from '@/db/schemas/rundowns'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: rundowns, createSchema: createRundownSchema, updateSchema: updateRundownSchema })
