import { z } from 'zod'

export const createAssetSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  url: z.string().min(1),
  kind: z.enum(['logo', 'photo', 'graphic', 'other']),
})
export const updateAssetSchema = createAssetSchema.partial()
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
