import { z } from 'zod'

export const createSponsorSchema = z.object({
  name: z.string().min(1).max(120),
  position: z.string().max(60).optional(),
  imageAssetId: z.string().uuid().optional(),
  bigImageAssetId: z.string().uuid().optional(),
  videoId: z.string().uuid().optional(),
})
export const updateSponsorSchema = createSponsorSchema.partial()
export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>
