import { z } from 'zod'

export const createDisplaySchema = z.object({ name: z.string().min(1) })
export type CreateDisplayInput = z.infer<typeof createDisplaySchema>

export const setSettingsSchema = z.object({ displayId: z.number().int().nullable() })
export type SetSettingsInput = z.infer<typeof setSettingsSchema>
