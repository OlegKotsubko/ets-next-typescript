import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Display = { id: number; uuid: string; name: string; projectId: number }

export const displaysApi = createApi({
  reducerPath: 'displaysApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Display'],
  endpoints: (b) => ({
    listDisplays: b.query<Display[], string>({
      query: (projectId) => `/projects/${projectId}/displays`,
      providesTags: (_r, _e, projectId) => [{ type: 'Display', id: `LIST:${projectId}` }],
    }),
    createDisplay: b.mutation<Display, { projectId: string; name: string }>({
      query: ({ projectId, name }) => ({ url: `/projects/${projectId}/displays`, method: 'POST', body: { name } }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Display', id: `LIST:${projectId}` }],
    }),
    deleteDisplay: b.mutation<void, { projectId: string; displayId: number }>({
      query: ({ projectId, displayId }) => ({ url: `/projects/${projectId}/displays/${displayId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Display', id: `LIST:${projectId}` }],
    }),
  }),
})

export const { useListDisplaysQuery, useCreateDisplayMutation, useDeleteDisplayMutation } = displaysApi
