import { createEntityApi } from './createEntityApi'
import type { Team } from '@/lib/entities/teams'
import type { CreateTeamInput, UpdateTeamInput, ReplaceRosterInput } from '@/db/schemas/teams'

const { api: baseApi } = createEntityApi<Team, CreateTeamInput, UpdateTeamInput>({
  reducerPath: 'teamsApi',
  tagType: 'Team',
  basePath: 'teams',
})

export const teamsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    replaceRoster: b.mutation<{ ok: true }, { projectId: string; teamId: string; data: ReplaceRosterInput }>({
      query: ({ projectId, teamId, data }) => ({
        url: `/projects/${projectId}/teams/${teamId}/roster`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_r, _e, { teamId }) => [{ type: 'Team', id: teamId }],
    }),
  }),
})

export const { useReplaceRosterMutation } = teamsApi

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hooks = teamsApi as any
export const useListTeamsQuery = hooks.useListTeamsQuery
export const useGetTeamQuery = hooks.useGetTeamQuery
export const useCreateTeamMutation = hooks.useCreateTeamMutation
export const useUpdateTeamMutation = hooks.useUpdateTeamMutation
export const useDeleteTeamMutation = hooks.useDeleteTeamMutation
