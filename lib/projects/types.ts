import { z } from 'zod'

// label MUST equal the folder name under projects/ — packageExists() matches on it.
export const overlayPackageConfigSchema = z.object({
  label: z.string().min(1),
  name: z.string().min(1),
  thumbnailPath: z.string().optional(),
})

export type OverlayPackageConfig = z.infer<typeof overlayPackageConfigSchema>
