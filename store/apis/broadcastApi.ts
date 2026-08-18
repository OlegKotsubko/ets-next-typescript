import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

type Ctx = { projectId: string; rundownId: string | number }

export const broadcastApi = createApi({
  reducerPath: 'broadcastApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    preview: b.mutation<void, Ctx & { overlayId: number; widget?: Record<string, unknown> }>({
      query: ({ projectId, rundownId, overlayId, widget }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/broadcast/preview`, method: 'POST', body: { overlayId, widget },
      }),
    }),
    air: b.mutation<void, Ctx & { overlayId: number }>({
      query: ({ projectId, rundownId, overlayId }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/broadcast/air`, method: 'POST', body: { overlayId },
      }),
    }),
    airAll: b.mutation<void, Ctx>({
      query: ({ projectId, rundownId }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/broadcast/air_all`, method: 'POST', body: {},
      }),
    }),
    hide: b.mutation<void, Ctx & { overlayId: number; channel: 'preview' | 'air' }>({
      query: ({ projectId, rundownId, overlayId, channel }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/broadcast/hide`, method: 'POST', body: { overlayId, channel },
      }),
    }),
    hideAll: b.mutation<void, Ctx & { channel: 'preview' | 'air' }>({
      query: ({ projectId, rundownId, channel }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/broadcast/hide_all`, method: 'POST', body: { channel },
      }),
    }),
    liveUpdate: b.mutation<void, Ctx & { overlayId: number; widget: Record<string, unknown> }>({
      query: ({ projectId, rundownId, overlayId, widget }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/broadcast/live_update`, method: 'POST', body: { overlayId, widget },
      }),
    }),
  }),
})

export const {
  usePreviewMutation, useAirMutation, useAirAllMutation, useHideMutation, useHideAllMutation, useLiveUpdateMutation,
} = broadcastApi
