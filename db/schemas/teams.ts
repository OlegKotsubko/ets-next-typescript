import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().min(1).max(120),
  avatarAssetId: z.string().uuid().optional(),
  leftImageAssetId: z.string().uuid().optional(),
  rightImageAssetId: z.string().uuid().optional(),
  bigAvatarAssetId: z.string().uuid().optional(),
})
export const updateTeamSchema = createTeamSchema.partial()
export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>

export const rosterSlotSchema = z.object({
  playerId: z.string().uuid(),
  slot: z.number().int().nonnegative(),
  isCaptain: z.boolean().default(false),
  isStandIn: z.boolean().default(false),
})
export const replaceRosterSchema = z.object({
  slots: z.array(rosterSlotSchema).max(5),
})
export type ReplaceRosterInput = z.infer<typeof replaceRosterSchema>
