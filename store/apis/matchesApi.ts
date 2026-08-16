import { createEntityApi } from './createEntityApi'
import type { Match } from '@/lib/entities/matches'
import type { CreateMatchInput, UpdateMatchInput } from '@/db/schemas/brackets'

const { api } = createEntityApi<Match, CreateMatchInput, UpdateMatchInput>({
  reducerPath: 'matchesApi',
  tagType: 'Match',
  basePath: 'matches',
})

export const matchesApi = api

const hooks = api as any
export const useListMatchesQuery = hooks.useListMatchesQuery
export const useGetMatchQuery = hooks.useGetMatchQuery
export const useCreateMatchMutation = hooks.useCreateMatchMutation
export const useUpdateMatchMutation = hooks.useUpdateMatchMutation
export const useDeleteMatchMutation = hooks.useDeleteMatchMutation
