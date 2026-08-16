import { z } from 'zod'
import { defineWidget, text } from '@/lib/overlays/widget-schema'

export const { model, fields } = defineWidget({
  title: text({ label: 'Title', default: 'MATCH', canLiveUpdate: true }),
})
export const actions = [] as const
export type Data = z.infer<typeof model>
