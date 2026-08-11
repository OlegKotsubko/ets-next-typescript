import { createAssetSchema } from '@/db/schemas/assets'
import type { EntityDef } from './types'

export type Asset = {
  id: string
  projectId: string
  filename: string
  mimeType: string
  sizeBytes: number
  url: string
  kind: string
  createdAt: string
  updatedAt: string
}

export const assetsEntityDef: EntityDef<Asset> = {
  entityName: 'Asset',
  fields: [
    { name: 'filename', label: 'Filename', widget: 'text' },
    {
      name: 'kind',
      label: 'Kind',
      widget: 'select',
      options: [
        { value: 'logo', label: 'Logo' },
        { value: 'photo', label: 'Photo' },
        { value: 'graphic', label: 'Graphic' },
        { value: 'other', label: 'Other' },
      ],
    },
  ],
  createSchema: createAssetSchema,
  columns: [
    { field: 'filename', headerName: 'Filename' },
    { field: 'kind', headerName: 'Kind' },
    { field: 'sizeBytes', headerName: 'Size (bytes)' },
  ],
}
