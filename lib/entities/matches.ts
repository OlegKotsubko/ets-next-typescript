import { createMatchSchema } from '@/db/schemas/brackets'
import type { EntityDef } from './types'

export type Match = {
  id: number
  projectId: number
  bracketId: number | null
  participantLeftId: number | null
  participantRightId: number | null
  scoreLeft: number
  scoreRight: number
  status: 'scheduled' | 'active' | 'finished'
  matchType: string
  createdAt: string
  updatedAt: string
}

export const matchesEntityDef: EntityDef<Match> = {
  entityName: 'Match',
  fields: [
    { name: 'bracketId', label: 'Bracket ID', widget: 'text' },
    { name: 'participantLeftId', label: 'Left participant ID', widget: 'text' },
    { name: 'participantRightId', label: 'Right participant ID', widget: 'text' },
    { name: 'scoreLeft', label: 'Score left', widget: 'text' },
    { name: 'scoreRight', label: 'Score right', widget: 'text' },
    {
      name: 'status',
      label: 'Status',
      widget: 'select',
      options: [
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'active', label: 'Active' },
        { value: 'finished', label: 'Finished' },
      ],
    },
    { name: 'matchType', label: 'Match type (bo1…bo6)', widget: 'text' },
  ],
  createSchema: createMatchSchema,
  columns: [
    { field: 'status', headerName: 'Status' },
    { field: 'matchType', headerName: 'Type' },
    { field: 'scoreLeft', headerName: 'L' },
    { field: 'scoreRight', headerName: 'R' },
  ],
}
