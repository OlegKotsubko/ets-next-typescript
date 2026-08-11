import { z } from 'zod'
import { extraSchema } from './shared'

export const createTalentSchema = z.object({
  name: z.string().min(1).max(100),
  surname: z.string().max(100).optional(),
  nickname: z.string().max(100).optional(),
  avatarAssetId: z.string().uuid().optional(),
  leftImageAssetId: z.string().uuid().optional(),
  rightImageAssetId: z.string().uuid().optional(),
  rosterAssetId: z.string().uuid().optional(),
  rosterLeftAssetId: z.string().uuid().optional(),
  rosterRightAssetId: z.string().uuid().optional(),
  extra: extraSchema,
})
export const updateTalentSchema = createTalentSchema.partial()
export type CreateTalentInput = z.infer<typeof createTalentSchema>
export type UpdateTalentInput = z.infer<typeof updateTalentSchema>
