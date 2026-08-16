import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Project = {
  id: number
  title: string
  heroSectionUrl: string | null
  status: 'draft' | 'upcoming' | 'ongoing' | 'ended'
  disciplineId: number | null
  isFavourite: boolean
}

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Project'],
  endpoints: (b) => ({
    listProjects: b.query<Project[], { status?: string } | void>({
      query: (arg) => {
        const status = arg && 'status' in arg ? arg.status : undefined
        return status ? `/projects?status=${status}` : '/projects'
      },
      providesTags: [{ type: 'Project', id: 'LIST' }],
    }),
    setFavourite: b.mutation<void, { projectId: number }>({
      query: ({ projectId }) => ({ url: `/projects/${projectId}/favourite`, method: 'PUT' }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
    }),
    unsetFavourite: b.mutation<void, { projectId: number }>({
      query: ({ projectId }) => ({ url: `/projects/${projectId}/favourite`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
    }),
  }),
})

export const {
  useListProjectsQuery, useSetFavouriteMutation, useUnsetFavouriteMutation,
} = projectsApi
