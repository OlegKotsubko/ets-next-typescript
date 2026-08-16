import { createTalentSchema } from '@/db/schemas/talents'
import type { EntityDef } from './types'

export type Talent = {
  id: number
  projectId: number
  nickname: string
  socialLinks: Record<string, string>
  extraText: string | null
  photoUrl: string | null
  createdAt: string
  updatedAt: string
}

export const talentsEntityDef: EntityDef<Talent> = {
  entityName: 'Talent',
  fields: [
    { name: 'nickname', label: 'Nickname', widget: 'text' },
    { name: 'photoUrl', label: 'Photo URL', widget: 'text' },
    { name: 'extraText', label: 'Extra text', widget: 'textarea' },
    { name: 'socialLinks', label: 'Social links', widget: 'social-links' },
  ],
  createSchema: createTalentSchema,
  columns: [
    { field: 'nickname', headerName: 'Nickname' },
  ],
}
