import { z } from 'zod'

export const createVideoSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  loop: z.boolean().default(false),
})
export const updateVideoSchema = createVideoSchema.partial()
export type CreateVideoInput = z.infer<typeof createVideoSchema>
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>
