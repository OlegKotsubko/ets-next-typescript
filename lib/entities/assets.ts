import { createAssetSchema } from '@/db/schemas/assets'
import type { EntityDef } from './types'

export type Asset = {
  id: number
  projectId: number
  name: string
  url: string
  assetType: 'decor' | 'background'
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  updatedAt: string
}

export const assetsEntityDef: EntityDef<Asset> = {
  entityName: 'Asset',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'url', label: 'URL', widget: 'text' },
    {
      name: 'assetType',
      label: 'Type',
      widget: 'select',
      options: [
        { value: 'decor', label: 'Decor' },
        { value: 'background', label: 'Background' },
      ],
    },
  ],
  createSchema: createAssetSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'assetType', headerName: 'Type' },
  ],
}
