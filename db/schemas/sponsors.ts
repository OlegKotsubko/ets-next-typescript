import { z } from 'zod'
import { optionalId } from './helpers'

export const createSponsorSchema = z.object({
  name: z.string().min(1).max(120),
  logoUrl: z.string().url().optional(),
  videoId: optionalId,
})
export const updateSponsorSchema = createSponsorSchema.partial()
export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>
