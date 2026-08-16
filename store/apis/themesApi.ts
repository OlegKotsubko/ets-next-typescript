import { createEntityApi } from './createEntityApi'
import type { Theme } from '@/lib/entities/themes'
import type { CreateThemeInput, UpdateThemeInput } from '@/db/schemas/themes'

const { api } = createEntityApi<Theme, CreateThemeInput, UpdateThemeInput>({
  reducerPath: 'themesApi',
  tagType: 'Theme',
  basePath: 'themes',
})

export const themesApi = api

const hooks = api as any
export const useListThemesQuery = hooks.useListThemesQuery
export const useCreateThemeMutation = hooks.useCreateThemeMutation
export const useUpdateThemeMutation = hooks.useUpdateThemeMutation
export const useDeleteThemeMutation = hooks.useDeleteThemeMutation
