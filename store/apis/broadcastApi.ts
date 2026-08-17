import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

type Ctx = { projectId: string; displayId: number }

export const broadcastApi = createApi({
  reducerPath: 'broadcastApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    preview: b.mutation<void, Ctx & { overlayId: number }>({
      query: ({ projectId, displayId, overlayId }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/preview`, method: 'POST', body: { overlayId },
      }),
    }),
    air: b.mutation<void, Ctx & { overlayId: number }>({
      query: ({ projectId, displayId, overlayId }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/air`, method: 'POST', body: { overlayId },
      }),
    }),
    hide: b.mutation<void, Ctx & { overlayId: number; channel: 'preview' | 'air' }>({
      query: ({ projectId, displayId, overlayId, channel }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/hide`, method: 'POST', body: { overlayId, channel },
      }),
    }),
    hideAll: b.mutation<void, Ctx & { channel: 'preview' | 'air' }>({
      query: ({ projectId, displayId, channel }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/hide_all`, method: 'POST', body: { channel },
      }),
    }),
    liveUpdate: b.mutation<void, Ctx & { overlayId: number; widget: Record<string, unknown> }>({
      query: ({ projectId, displayId, overlayId, widget }) => ({
        url: `/projects/${projectId}/broadcast/${displayId}/live_update`, method: 'POST', body: { overlayId, widget },
      }),
    }),
  }),
})

export const {
  usePreviewMutation, useAirMutation, useHideMutation, useHideAllMutation, useLiveUpdateMutation,
} = broadcastApi
