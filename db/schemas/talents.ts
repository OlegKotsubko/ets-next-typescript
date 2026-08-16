import { z } from 'zod'

export const createTalentSchema = z.object({
  nickname: z.string().min(1).max(60),
  socialLinks: z.record(z.string(), z.string()).default({}),
  extraText: z.string().optional(),
  photoUrl: z.string().url().optional(),
})
export const updateTalentSchema = createTalentSchema.partial()
export type CreateTalentInput = z.infer<typeof createTalentSchema>
export type UpdateTalentInput = z.infer<typeof updateTalentSchema>
