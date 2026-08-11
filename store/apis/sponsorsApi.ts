import { createEntityApi } from './createEntityApi'
import type { Sponsor } from '@/lib/entities/sponsors'
import type { CreateSponsorInput, UpdateSponsorInput } from '@/db/schemas/sponsors'

const { api } = createEntityApi<Sponsor, CreateSponsorInput, UpdateSponsorInput>({
  reducerPath: 'sponsorsApi',
  tagType: 'Sponsor',
  basePath: 'sponsors',
})

export const sponsorsApi = api

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hooks = api as any
export const useListSponsorsQuery = hooks.useListSponsorsQuery
export const useGetSponsorQuery = hooks.useGetSponsorQuery
export const useCreateSponsorMutation = hooks.useCreateSponsorMutation
export const useUpdateSponsorMutation = hooks.useUpdateSponsorMutation
export const useDeleteSponsorMutation = hooks.useDeleteSponsorMutation
