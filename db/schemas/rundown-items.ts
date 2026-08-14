import { z } from 'zod'

// `data` is validated dynamically against the title's model.ts at the API
// boundary (see the items route), so it is an open record here.
export const createRundownItemSchema = z.object({
  titleKey: z.string().min(1),
  label: z.string().max(120).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
})

// label and data are independently patchable; position moves via the order route.
export const updateRundownItemSchema = z.object({
  label: z.string().max(120).nullish(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const reorderRundownItemsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})

export type CreateRundownItemInput = z.infer<typeof createRundownItemSchema>
export type UpdateRundownItemInput = z.infer<typeof updateRundownItemSchema>
export type ReorderRundownItemsInput = z.infer<typeof reorderRundownItemsSchema>
