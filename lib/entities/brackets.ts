import { createBracketSchema } from '@/db/schemas/brackets'
import type { EntityDef } from './types'

export type Bracket = {
  id: number
  projectId: number
  name: string
  structure: unknown
  createdAt: string
  updatedAt: string
}

// Structure (the stored tree) is set via API/import, not this simple form; the
// key correction is dropping participant_count generation.
export const bracketsEntityDef: EntityDef<Bracket> = {
  entityName: 'Bracket',
  fields: [
    { name: 'name', label: 'Name', widget: 'text' },
  ],
  createSchema: createBracketSchema,
  columns: [
    { field: 'name', headerName: 'Name' },
  ],
}
