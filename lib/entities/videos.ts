import { createVideoSchema } from '@/db/schemas/videos'
import type { EntityDef } from './types'

export type Video = {
  id: number
  projectId: number
  name: string
  url: string
  videoType: 'mixer' | 'background'
  createdAt: string
  updatedAt: string
}

export const videosEntityDef: EntityDef<Video> = {
  entityName: 'Video',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'url', label: 'URL', widget: 'text' },
    {
      name: 'videoType',
      label: 'Type',
      widget: 'select',
      options: [
        { value: 'mixer', label: 'Mixer / stinger' },
        { value: 'background', label: 'Background loop' },
      ],
    },
  ],
  createSchema: createVideoSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'videoType', headerName: 'Type' },
  ],
}
