import { z } from 'zod'

export const LowerThirdFields = z.object({
  playerName: z.string().min(1).max(40),
  teamName: z.string().max(40).optional(),
  position: z.enum(['guard', 'forward', 'center']).optional(),
})

// A lower third is pure data — nothing to start or stop.
export const LowerThirdActions = [] as const

export type LowerThirdData = z.infer<typeof LowerThirdFields>
