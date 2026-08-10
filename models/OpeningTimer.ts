// Reusable OpeningTimer contract. A package's model.ts composes this with
// .omit()/.extend() so projects can drop or add fields without forking.
import { z } from 'zod'

export const OpeningTimerFields = z.object({
  hours: z.number().int().min(0).max(99),
  minutes: z.number().int().min(0).max(59),
  seconds: z.number().int().min(0).max(59),
  main_text: z.string().max(80),
  sponsors: z.array(z.string()).default([]),
})

// Declared command actions: thread-widget buttons, and the allow-list the
// /command route validates against. Universal actions (air/preview/hide/update)
// are implicit for every title and are NOT listed here.
export const OpeningTimerActions = ['start', 'stop', 'reset'] as const

export type OpeningTimerData = z.infer<typeof OpeningTimerFields>
