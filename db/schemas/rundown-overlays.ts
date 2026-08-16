import { z } from 'zod'

export const createRundownOverlaySchema = z.object({
  model: z.string().min(1),
  widgetName: z.string().min(1).optional(),
  layer: z.coerce.number().int().min(1).max(7).default(1),
  color: z.coerce.number().int().min(1).max(7).default(1),
  displayFilter: z.string().optional(),
  isFullscreen: z.boolean().optional(),
})
export type CreateRundownOverlayInput = z.infer<typeof createRundownOverlaySchema>

export const updateRundownOverlaySchema = z.object({
  widgetName: z.string().min(1).optional(),
  layer: z.coerce.number().int().min(1).max(7).optional(),
  color: z.coerce.number().int().min(1).max(7).optional(),
  displayFilter: z.string().nullish(),
  isFullscreen: z.boolean().optional(),
  // Validated against the overlay's model.ts in the route.
  widget: z.record(z.string(), z.unknown()).optional(),
})
export type UpdateRundownOverlayInput = z.infer<typeof updateRundownOverlaySchema>

export const reorderSchema = z.object({ orderedIds: z.array(z.number().int()).min(1) })
