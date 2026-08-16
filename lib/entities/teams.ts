import { createTeamSchema } from '@/db/schemas/teams'
import type { EntityDef } from './types'

export type TeamLogo = { photoType: string; url: string }
export type TeamRosterMember = { playerId: number; isCaptain: boolean; isStandIn: boolean }

export type Team = {
  id: number
  projectId: number
  name: string
  country: string | null
  region: string | null
  disciplineId: number | null
  opendotaId: string | null
  socialLinks: Record<string, string>
  logos?: TeamLogo[]
  roster?: TeamRosterMember[]
  createdAt: string
  updatedAt: string
}

const LOGO_TYPES = ['logo', 'ets_logo', 'ets_graphics']

export const teamsEntityDef: EntityDef<Team> = {
  entityName: 'Team',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
    { name: 'country', label: 'Country', widget: 'text' },
    { name: 'region', label: 'Region', widget: 'text' },
    { name: 'disciplineId', label: 'Discipline', widget: 'select', optionsFrom: 'tags' },
    { name: 'opendotaId', label: 'OpenDota ID', widget: 'text' },
    { name: 'socialLinks', label: 'Social links', widget: 'social-links' },
    { name: 'logos', label: 'Logos', widget: 'typed-images', photoTypes: LOGO_TYPES },
    { name: 'roster', label: 'Roster', widget: 'roster' },
  ],
  createSchema: createTeamSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
    { field: 'country', headerName: 'Country' },
    { field: 'region', headerName: 'Region' },
  ],
}
