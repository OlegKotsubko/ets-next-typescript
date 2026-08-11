import { assets } from '@/db/schema'
import { createAssetSchema, updateAssetSchema } from '@/db/schemas/assets'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export const { GET, POST } = createCrudHandlers({ table: assets, createSchema: createAssetSchema, updateSchema: updateAssetSchema })
