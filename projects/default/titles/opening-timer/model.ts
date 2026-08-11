import { z } from 'zod'
import { OpeningTimerFields, OpeningTimerActions } from '@/models/OpeningTimer'

// This package drops sponsors and adds a subtitle — the omit/extend pattern.
export const model = OpeningTimerFields.omit({ sponsors: true }).extend({
  subtitle: z.string().max(60).optional(),
})

export const actions = OpeningTimerActions
export type Data = z.infer<typeof model>
