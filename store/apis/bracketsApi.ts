import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BracketRound, UpdateMatchInput } from '@/db/schemas/brackets'

export type Bracket = {
  id: string
  projectId: string
  name: string
  format: string
  participantCount: number
  rounds: BracketRound[]
  createdAt: string
  updatedAt: string
}

export const bracketsApi = createApi({
  reducerPath: 'bracketsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Bracket'],
  endpoints: (b) => ({
    listBrackets: b.query<Bracket[], string>({
      query: (projectId) => `/projects/${projectId}/brackets`,
      providesTags: (_r, _e, projectId) => [{ type: 'Bracket', id: `LIST:${projectId}` }],
    }),
    createBracket: b.mutation<Bracket, { projectId: string; data: { name: string; participantCount: number } }>({
      query: ({ projectId, data }) => ({ url: `/projects/${projectId}/brackets`, method: 'POST', body: data }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Bracket', id: `LIST:${projectId}` }],
    }),
    updateMatch: b.mutation<Bracket, { projectId: string; bracketId: string; matchId: string; data: UpdateMatchInput }>({
      query: ({ projectId, bracketId, matchId, data }) => ({
        url: `/projects/${projectId}/brackets/${bracketId}/matches/${matchId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Bracket', id: `LIST:${projectId}` }],
    }),
  }),
})

export const { useListBracketsQuery, useCreateBracketMutation, useUpdateMatchMutation } = bracketsApi
