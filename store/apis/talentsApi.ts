import { createEntityApi } from './createEntityApi'
import type { Talent } from '@/lib/entities/talents'
import type { CreateTalentInput, UpdateTalentInput } from '@/db/schemas/talents'

const { api } = createEntityApi<Talent, CreateTalentInput, UpdateTalentInput>({
  reducerPath: 'talentsApi',
  tagType: 'Talent',
  basePath: 'talents',
})

export const talentsApi = api
 
const hooks = api as any
export const useListTalentsQuery = hooks.useListTalentsQuery
export const useGetTalentQuery = hooks.useGetTalentQuery
export const useCreateTalentMutation = hooks.useCreateTalentMutation
export const useUpdateTalentMutation = hooks.useUpdateTalentMutation
export const useDeleteTalentMutation = hooks.useDeleteTalentMutation
