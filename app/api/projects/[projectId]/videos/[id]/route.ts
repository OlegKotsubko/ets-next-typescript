import { videos } from '@/db/schema'
import { createVideoSchema, updateVideoSchema } from '@/db/schemas/videos'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { PATCH, DELETE } = createCrudHandlers({ table: videos, createSchema: createVideoSchema, updateSchema: updateVideoSchema })
