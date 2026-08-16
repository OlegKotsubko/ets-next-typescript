import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { Tag } from '@/lib/entities/tags'
import type { CreateTagInput, UpdateTagInput } from '@/db/schemas/tags'

// Global tags api — base path /tags (not project-scoped).
export const tagsApi = createApi({
  reducerPath: 'tagsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Tag'],
  endpoints: (b) => ({
    listTags: b.query<Tag[], void>({
      query: () => '/tags',
      providesTags: [{ type: 'Tag', id: 'LIST' }],
    }),
    createTag: b.mutation<Tag, CreateTagInput>({
      query: (body) => ({ url: '/tags', method: 'POST', body }),
      invalidatesTags: [{ type: 'Tag', id: 'LIST' }],
    }),
    updateTag: b.mutation<Tag, { id: number; data: UpdateTagInput }>({
      query: ({ id, data }) => ({ url: `/tags/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: [{ type: 'Tag', id: 'LIST' }],
    }),
    deleteTag: b.mutation<void, number>({
      query: (id) => ({ url: `/tags/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Tag', id: 'LIST' }],
    }),
  }),
})

export const {
  useListTagsQuery, useCreateTagMutation, useUpdateTagMutation, useDeleteTagMutation,
} = tagsApi
