import { createTalentSchema } from '@/db/schemas/talents'
import type { EntityDef } from './types'
import type { Extra } from '@/db/schemas/shared'

export type Talent = {
  id: string
  projectId: string
  name: string
  surname: string | null
  nickname: string | null
  avatarAssetId: string | null
  leftImageAssetId: string | null
  rightImageAssetId: string | null
  rosterAssetId: string | null
  rosterLeftAssetId: string | null
  rosterRightAssetId: string | null
  extra: Extra
  createdAt: string
  updatedAt: string
}

export const talentsEntityDef: EntityDef<Talent> = {
  entityName: 'Talent',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'surname', label: 'Surname', widget: 'text' },
    { name: 'nickname', label: 'Nickname', widget: 'text' },
    { name: 'avatarAssetId', label: 'Avatar', widget: 'asset-picker' },
    { name: 'leftImageAssetId', label: 'Left Image', widget: 'asset-picker' },
    { name: 'rightImageAssetId', label: 'Right Image', widget: 'asset-picker' },
    { name: 'rosterAssetId', label: 'Roster Image', widget: 'asset-picker' },
    { name: 'rosterLeftAssetId', label: 'Roster Left Image', widget: 'asset-picker' },
    { name: 'rosterRightAssetId', label: 'Roster Right Image', widget: 'asset-picker' },
    { name: 'extra', label: 'Extra fields', widget: 'extra-map' },
  ],
  createSchema: createTalentSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'surname', headerName: 'Surname' },
    { field: 'nickname', headerName: 'Nickname' },
  ],
}
