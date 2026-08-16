import { z } from 'zod'

export const createAssetSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  assetType: z.enum(['decor', 'background']).default('decor'),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
})
export const updateAssetSchema = createAssetSchema.partial()
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
