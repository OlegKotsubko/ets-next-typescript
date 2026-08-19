import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Project = {
  id: number
  title: string
  heroSectionUrl: string | null
  status: 'draft' | 'upcoming' | 'ongoing' | 'ended'
  disciplineId: number | null
  overlayPacks: string[]
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
    getProject: b.query<Project, string>({
      query: (projectId) => `/projects/${projectId}`,
      providesTags: (_r, _e, projectId) => [{ type: 'Project', id: projectId }],
    }),
    createProject: b.mutation<Project, { title: string; status?: string; overlayPacks?: string[] }>({
      query: (data) => ({ url: '/projects', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
    }),
    updateProject: b.mutation<Project, { projectId: number; data: Partial<{ title: string; status: string; overlayPacks: string[] }> }>({
      query: ({ projectId, data }) => ({ url: `/projects/${projectId}`, method: 'PATCH', body: data }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Project', id: 'LIST' }, { type: 'Project', id: String(projectId) }],
    }),
    deleteProject: b.mutation<void, { projectId: number }>({
      query: ({ projectId }) => ({ url: `/projects/${projectId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
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
  useListProjectsQuery, useGetProjectQuery,
  useCreateProjectMutation, useUpdateProjectMutation, useDeleteProjectMutation,
  useSetFavouriteMutation, useUnsetFavouriteMutation,
} = projectsApi
