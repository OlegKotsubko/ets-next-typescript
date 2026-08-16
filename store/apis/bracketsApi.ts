import { createEntityApi } from './createEntityApi'
import type { Bracket } from '@/lib/entities/brackets'
import type { CreateBracketInput, UpdateBracketInput } from '@/db/schemas/brackets'

const { api } = createEntityApi<Bracket, CreateBracketInput, UpdateBracketInput>({
  reducerPath: 'bracketsApi',
  tagType: 'Bracket',
  basePath: 'brackets',
})

export const bracketsApi = api

const hooks = api as any
export const useListBracketsQuery = hooks.useListBracketsQuery
export const useGetBracketQuery = hooks.useGetBracketQuery
export const useCreateBracketMutation = hooks.useCreateBracketMutation
export const useUpdateBracketMutation = hooks.useUpdateBracketMutation
export const useDeleteBracketMutation = hooks.useDeleteBracketMutation
