import { createSponsorSchema } from '@/db/schemas/sponsors'
import type { EntityDef } from './types'

export type Sponsor = {
  id: string
  projectId: string
  name: string
  position: string | null
  imageAssetId: string | null
  bigImageAssetId: string | null
  videoId: string | null
  createdAt: string
  updatedAt: string
}

// NOTE: videoId is a real select-from-Videos relationship, but this pass renders it as a
// plain select with no options wired up yet (a known, accepted MVP gap — see the plan's
// self-review notes). Sponsors are still fully usable without a linked video.
export const sponsorsEntityDef: EntityDef<Sponsor> = {
  entityName: 'Sponsor',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'position', label: 'Position', widget: 'text' },
    { name: 'imageAssetId', label: 'Image', widget: 'asset-picker' },
    { name: 'bigImageAssetId', label: 'Big Image', widget: 'asset-picker' },
    { name: 'videoId', label: 'Video', widget: 'select', options: [] },
  ],
  createSchema: createSponsorSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'position', headerName: 'Position' },
  ],
}
