import { createVideoSchema } from '@/db/schemas/videos'
import type { EntityDef } from './types'

export type Video = {
  id: string
  projectId: string
  name: string
  url: string
  durationMs: number | null
  loop: boolean
  createdAt: string
  updatedAt: string
}

// NOTE: loop is a boolean field rendered as text "true"/"false" for this pass — a known,
// accepted MVP gap pending a dedicated boolean widget (see the plan's self-review notes).
export const videosEntityDef: EntityDef<Video> = {
  entityName: 'Video',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'url', label: 'URL', widget: 'text' },
    { name: 'durationMs', label: 'Duration (ms)', widget: 'text' },
    { name: 'loop', label: 'Loop ("true" or "false")', widget: 'text' },
  ],
  createSchema: createVideoSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'url', headerName: 'URL' },
  ],
}
