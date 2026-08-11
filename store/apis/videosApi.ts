import { createEntityApi } from './createEntityApi'
import type { Video } from '@/lib/entities/videos'
import type { CreateVideoInput, UpdateVideoInput } from '@/db/schemas/videos'

const { api } = createEntityApi<Video, CreateVideoInput, UpdateVideoInput>({
  reducerPath: 'videosApi',
  tagType: 'Video',
  basePath: 'videos',
})

export const videosApi = api

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hooks = api as any
export const useListVideosQuery = hooks.useListVideosQuery
export const useGetVideoQuery = hooks.useGetVideoQuery
export const useCreateVideoMutation = hooks.useCreateVideoMutation
export const useUpdateVideoMutation = hooks.useUpdateVideoMutation
export const useDeleteVideoMutation = hooks.useDeleteVideoMutation
