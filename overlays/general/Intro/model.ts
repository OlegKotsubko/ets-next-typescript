import { z } from 'zod'
import { defineWidget, text } from '@/lib/overlays/widget-schema'

export const { model, fields } = defineWidget({
  heading: text({ label: 'Heading', default: 'WELCOME', canLiveUpdate: true }),
  subheading: text({ label: 'Subheading', default: '' }),
})
export const actions = [] as const
export type Data = z.infer<typeof model>
