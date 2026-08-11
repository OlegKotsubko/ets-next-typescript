import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const projectCssApi = createApi({
  reducerPath: 'projectCssApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['ProjectCss'],
  endpoints: (b) => ({
    getCss: b.query<{ projectId: string; css: string }, string>({
      query: (projectId) => `/projects/${projectId}/css`,
      providesTags: (_r, _e, projectId) => [{ type: 'ProjectCss', id: projectId }],
    }),
    updateCss: b.mutation<{ projectId: string; css: string }, { projectId: string; css: string }>({
      query: ({ projectId, css }) => ({ url: `/projects/${projectId}/css`, method: 'PUT', body: { css } }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'ProjectCss', id: projectId }],
    }),
  }),
})

export const { useGetCssQuery, useUpdateCssMutation } = projectCssApi
