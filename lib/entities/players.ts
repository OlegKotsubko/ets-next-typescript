import { createPlayerSchema } from '@/db/schemas/players'
import type { EntityDef } from './types'

export type PlayerPhoto = { photoType: string; url: string }

export type Player = {
  id: number
  projectId: number
  nickname: string
  firstName: string | null
  lastName: string | null
  country: string | null
  gameId: string | null
  position: string | null
  role: string | null
  birthDate: string | null
  socialLinks: Record<string, string>
  photos?: PlayerPhoto[]
  createdAt: string
  updatedAt: string
}

const PHOTO_TYPES = ['avatar', 'left', 'right', 'roster', 'left_lg', 'right_lg', 'statistics']

export const playersEntityDef: EntityDef<Player> = {
  entityName: 'Player',
  fields: [
    { name: 'nickname', label: 'Nickname', widget: 'text' },
    { name: 'firstName', label: 'First name', widget: 'text' },
    { name: 'lastName', label: 'Last name', widget: 'text' },
    { name: 'country', label: 'Country', widget: 'text' },
    { name: 'gameId', label: 'Game ID', widget: 'text' },
    { name: 'position', label: 'Position', widget: 'text' },
    { name: 'role', label: 'Role', widget: 'text' },
    { name: 'birthDate', label: 'Birth date (YYYY-MM-DD)', widget: 'text' },
    { name: 'socialLinks', label: 'Social links', widget: 'social-links' },
    { name: 'photos', label: 'Photos', widget: 'typed-images', photoTypes: PHOTO_TYPES },
  ],
  createSchema: createPlayerSchema,
  columns: [
    { field: 'nickname', headerName: 'Nickname' },
    { field: 'firstName', headerName: 'First name' },
    { field: 'lastName', headerName: 'Last name' },
    { field: 'country', headerName: 'Country' },
  ],
}
