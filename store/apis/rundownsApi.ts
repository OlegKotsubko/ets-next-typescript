import { createEntityApi } from './createEntityApi'
import type { Rundown } from '@/lib/entities/rundowns'
import type { CreateRundownInput, UpdateRundownInput } from '@/db/schemas/rundowns'

const { api } = createEntityApi<Rundown, CreateRundownInput, UpdateRundownInput>({
  reducerPath: 'rundownsApi',
  tagType: 'Rundown',
  basePath: 'rundowns',
})

export const rundownsApi = api

const hooks = api as any
export const useListRundownsQuery = hooks.useListRundownsQuery
export const useGetRundownQuery = hooks.useGetRundownQuery
export const useCreateRundownMutation = hooks.useCreateRundownMutation
export const useUpdateRundownMutation = hooks.useUpdateRundownMutation
export const useDeleteRundownMutation = hooks.useDeleteRundownMutation
