import { z } from 'zod'

const photoType = z.enum(['avatar', 'left', 'right', 'roster', 'left_lg', 'right_lg', 'statistics'])

export const createPlayerSchema = z.object({
  nickname: z.string().min(1).max(25),
  firstName: z.string().max(25).optional(),
  lastName: z.string().max(25).optional(),
  country: z.string().optional(),
  disciplineId: z.number().int().optional(),
  gameId: z.string().regex(/^[a-z0-9]*$/i).optional(),
  position: z.string().optional(),
  role: z.string().optional(),
  birthDate: z.string().date().optional(),
  socialLinks: z.record(z.string(), z.string()).default({}),
  photos: z.array(z.object({ photoType, url: z.string().url() })).optional(),
})
export const updatePlayerSchema = createPlayerSchema.partial()
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>
