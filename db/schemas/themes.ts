import { z } from 'zod'

export const createThemeSchema = z.object({
  name: z.string().min(1).max(120),
  isActive: z.boolean().default(false),
  colors: z.array(z.object({ name: z.string().min(1), code: z.string().min(1) })).default([]),
  assetIds: z.array(z.number().int()).default([]),
})
export const updateThemeSchema = createThemeSchema.partial()
export type CreateThemeInput = z.infer<typeof createThemeSchema>
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>
