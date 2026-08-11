import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type OverlayPackage = { label: string; name: string; thumbnailPath?: string }

export const overlayPackagesApi = createApi({
  reducerPath: 'overlayPackagesApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    listOverlayPackages: b.query<OverlayPackage[], void>({
      query: () => '/overlay-packages',
    }),
  }),
})

export const { useListOverlayPackagesQuery } = overlayPackagesApi
