import { createTeamSchema } from '@/db/schemas/teams'
import type { EntityDef } from './types'

export type Team = {
  id: string
  projectId: string
  name: string
  avatarAssetId: string | null
  leftImageAssetId: string | null
  rightImageAssetId: string | null
  bigAvatarAssetId: string | null
  createdAt: string
  updatedAt: string
}

export const teamsEntityDef: EntityDef<Team> = {
  entityName: 'Team',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'avatarAssetId', label: 'Avatar', widget: 'asset-picker' },
    { name: 'leftImageAssetId', label: 'Left Image', widget: 'asset-picker' },
    { name: 'rightImageAssetId', label: 'Right Image', widget: 'asset-picker' },
    { name: 'bigAvatarAssetId', label: 'Big Avatar', widget: 'asset-picker' },
  ],
  createSchema: createTeamSchema,
  columns: [{ field: 'name', headerName: 'Name' }],
}
