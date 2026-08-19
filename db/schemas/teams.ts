import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().optional(),
  region: z.string().optional(),
  opendotaId: z.string().optional(),
  socialLinks: z.record(z.string(), z.string()).default({}),
  logos: z.array(z.object({
    photoType: z.enum(['logo', 'ets_logo', 'ets_graphics']),
    url: z.string().url(),
  })).optional(),
  roster: z.array(z.object({
    playerId: z.number().int(),
    isCaptain: z.boolean().default(false),
    isStandIn: z.boolean().default(false),
  })).max(10).optional(),
})
export const updateTeamSchema = createTeamSchema.partial()
export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
