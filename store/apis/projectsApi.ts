import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Project = {
  id: string
  name: string
  mode: 'team_vs_team' | 'player_vs_player'
  label: string
  pictureUrl: string | null
  eventDate: string | null
  createdAt: string
  updatedAt: string
}

export type CreateProjectInput = {
  name: string
  mode: 'team_vs_team' | 'player_vs_player'
  label: string
  eventDate?: string
}

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Project'],
  endpoints: (b) => ({
    listProjects: b.query<Project[], void>({
      query: () => '/projects',
      providesTags: [{ type: 'Project', id: 'LIST' }],
    }),
    createProject: b.mutation<Project, CreateProjectInput>({
      query: (data) => ({ url: '/projects', method: 'POST', body: data }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
    }),
  }),
})

export const { useListProjectsQuery, useCreateProjectMutation } = projectsApi
