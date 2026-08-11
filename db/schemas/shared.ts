import { z } from 'zod'

export const extraSchema = z.record(z.string().min(1), z.string()).default({})
export type Extra = z.infer<typeof extraSchema>
