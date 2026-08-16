import { z } from 'zod'
import { optionalId } from './helpers'

// A bracket is a STORED tree (no participant_count generation).
export const createBracketSchema = z.object({
  name: z.string().min(1).max(120),
  structure: z.unknown().default({}),
})
export const updateBracketSchema = createBracketSchema.partial()
export type CreateBracketInput = z.infer<typeof createBracketSchema>
export type UpdateBracketInput = z.infer<typeof updateBracketSchema>

export const createMatchSchema = z.object({
  bracketId: optionalId,
  participantLeftId: optionalId,
  participantRightId: optionalId,
  scoreLeft: z.coerce.number().int().default(0),
  scoreRight: z.coerce.number().int().default(0),
  status: z.enum(['scheduled', 'active', 'finished']).default('scheduled'),
  matchType: z.string().default('bo1'),
})
export const updateMatchSchema = createMatchSchema.partial()
export type CreateMatchInput = z.infer<typeof createMatchSchema>
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>

export const upsertSeatingSchema = z.object({
  leftTeamId: optionalId,
  rightTeamId: optionalId,
  leftTeamPlayers: z.array(z.string()).default([]),
  rightTeamPlayers: z.array(z.string()).default([]),
  isActive: z.boolean().default(false),
})
export type UpsertSeatingInput = z.infer<typeof upsertSeatingSchema>
