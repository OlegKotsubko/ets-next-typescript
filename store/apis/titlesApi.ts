import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { TitleOption } from '@/lib/titles/listTitleOptions'

export const titlesApi = createApi({
  reducerPath: 'titlesApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    listTitles: b.query<TitleOption[], { projectId: string }>({
      query: ({ projectId }) => `/projects/${projectId}/titles`,
    }),
  }),
})

export const { useListTitlesQuery } = titlesApi
