import { sponsors } from '@/db/schema'
import { createSponsorSchema, updateSponsorSchema } from '@/db/schemas/sponsors'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: sponsors, createSchema: createSponsorSchema, updateSchema: updateSponsorSchema })
