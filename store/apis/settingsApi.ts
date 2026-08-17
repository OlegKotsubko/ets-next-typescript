import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Settings = { userId: string; displayId: number | null }

export const settingsApi = createApi({
  reducerPath: 'settingsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Settings'],
  endpoints: (b) => ({
    getSettings: b.query<Settings, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),
    setSettings: b.mutation<Settings, { displayId: number | null }>({
      query: (body) => ({ url: '/settings', method: 'PUT', body }),
      invalidatesTags: ['Settings'],
    }),
  }),
})

export const { useGetSettingsQuery, useSetSettingsMutation } = settingsApi
