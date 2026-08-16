import { z } from 'zod'
import { defineWidget, text } from '@/lib/overlays/widget-schema'

export const { model, fields } = defineWidget({
  text: text({ label: 'Headline', default: 'Text sample', canLiveUpdate: true }),
})
export const actions = ['next'] as const
export type Data = z.infer<typeof model>
