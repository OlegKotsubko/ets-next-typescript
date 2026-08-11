import { createEntityApi } from './createEntityApi'
import type { Asset } from '@/lib/entities/assets'
import type { CreateAssetInput, UpdateAssetInput } from '@/db/schemas/assets'

const { api } = createEntityApi<Asset, CreateAssetInput, UpdateAssetInput>({
  reducerPath: 'assetsApi',
  tagType: 'Asset',
  basePath: 'assets',
})

export const assetsApi = api
 
const hooks = api as any
export const useListAssetsQuery = hooks.useListAssetsQuery
export const useGetAssetQuery = hooks.useGetAssetQuery
export const useCreateAssetMutation = hooks.useCreateAssetMutation
export const useUpdateAssetMutation = hooks.useUpdateAssetMutation
export const useDeleteAssetMutation = hooks.useDeleteAssetMutation
