import { z } from 'zod'

export const updateProjectCssSchema = z.object({
  css: z.string().max(50_000),
})
export type UpdateProjectCssInput = z.infer<typeof updateProjectCssSchema>
