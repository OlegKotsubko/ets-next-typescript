import { z } from 'zod'

// Tournaments are absorbed (not created in-app). The only mutation from the
// gallery is toggling a per-operator favourite.
export const setFavouriteSchema = z.object({
  favourite: z.boolean(),
})
export type SetFavouriteInput = z.infer<typeof setFavouriteSchema>

// Optional status filter for GET /api/projects.
export const projectStatus = z.enum(['draft', 'upcoming', 'ongoing', 'ended'])
export type ProjectStatus = z.infer<typeof projectStatus>

// Tournaments are authored in-app (create/edit/delete from the gallery).
export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  status: projectStatus.default('draft'),
  overlayPacks: z.array(z.string()).default([]),
})
export const updateProjectSchema = createProjectSchema.partial()
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
