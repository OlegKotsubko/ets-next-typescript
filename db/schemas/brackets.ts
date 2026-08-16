import { z } from 'zod'

export const bracketMatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scheduledAt: z.string().datetime().nullable(),
  leftParticipantId: z.string().uuid().nullable(),
  rightParticipantId: z.string().uuid().nullable(),
  scoreLeft: z.number().int().nonnegative().default(0),
  scoreRight: z.number().int().nonnegative().default(0),
  status: z.enum(['scheduled', 'active', 'finished']).default('scheduled'),
  matchType: z.enum(['bo1', 'bo2', 'bo3', 'bo4', 'bo5', 'bo6']).default('bo1'),
  placeholderLeft: z.string().default(''),
  placeholderRight: z.string().default(''),
  winnerId: z.string().uuid().nullable(),
})

export const bracketRoundSchema = z.object({
  name: z.string(),
  matches: z.array(bracketMatchSchema),
})
export type BracketRound = z.infer<typeof bracketRoundSchema>
export type BracketMatch = z.infer<typeof bracketMatchSchema>

export const createBracketSchema = z.object({
  name: z.string().min(1),
  participantCount: z.number().int().refine((n) => n >= 2 && (n & (n - 1)) === 0, 'must be a power of 2'),
})

export const updateMatchSchema = bracketMatchSchema.omit({ id: true }).partial()
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>
