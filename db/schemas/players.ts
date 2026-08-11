import { z } from 'zod'
import { extraSchema } from './shared'

export const createPlayerSchema = z.object({
  name: z.string().min(1).max(100),
  surname: z.string().max(100).optional(),
  nickname: z.string().max(100).optional(),
  avatarAssetId: z.string().uuid().optional(),
  imageAssetId: z.string().uuid().optional(),
  leftImageAssetId: z.string().uuid().optional(),
  rightImageAssetId: z.string().uuid().optional(),
  rosterAssetId: z.string().uuid().optional(),
  rosterLeftAssetId: z.string().uuid().optional(),
  rosterRightAssetId: z.string().uuid().optional(),
  extra: extraSchema,
})
export const updatePlayerSchema = createPlayerSchema.partial()
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>
