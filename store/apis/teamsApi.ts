import { createEntityApi } from './createEntityApi'
import type { Team } from '@/lib/entities/teams'
import type { CreateTeamInput, UpdateTeamInput } from '@/db/schemas/teams'

const { api } = createEntityApi<Team, CreateTeamInput, UpdateTeamInput>({
  reducerPath: 'teamsApi',
  tagType: 'Team',
  basePath: 'teams',
})

export const teamsApi = api

const hooks = api as any
export const useListTeamsQuery = hooks.useListTeamsQuery
export const useGetTeamQuery = hooks.useGetTeamQuery
export const useCreateTeamMutation = hooks.useCreateTeamMutation
export const useUpdateTeamMutation = hooks.useUpdateTeamMutation
export const useDeleteTeamMutation = hooks.useDeleteTeamMutation
