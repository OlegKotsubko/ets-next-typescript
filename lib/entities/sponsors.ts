import { createSponsorSchema } from '@/db/schemas/sponsors'
import type { EntityDef } from './types'

export type Sponsor = {
  id: number
  projectId: number
  name: string
  logoUrl: string | null
  videoId: number | null
  createdAt: string
  updatedAt: string
}

export const sponsorsEntityDef: EntityDef<Sponsor> = {
  entityName: 'Sponsor',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'logoUrl', label: 'Logo URL', widget: 'text' },
    { name: 'videoId', label: 'Video ID', widget: 'text' },
  ],
  createSchema: createSponsorSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
  ],
}
