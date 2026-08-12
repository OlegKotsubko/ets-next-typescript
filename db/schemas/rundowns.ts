import { z } from 'zod'

export const createRundownSchema = z.object({
  name: z.string().min(1).max(120),
})
export const updateRundownSchema = createRundownSchema.partial()
export type CreateRundownInput = z.infer<typeof createRundownSchema>
export type UpdateRundownInput = z.infer<typeof updateRundownSchema>
