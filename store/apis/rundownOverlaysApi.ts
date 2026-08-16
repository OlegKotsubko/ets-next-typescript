import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type RundownOverlay = {
  id: number
  rundownId: number
  projectId: number
  model: string
  category: string | null
  template: string | null
  widgetName: string
  layer: number
  color: number
  displayFilter: string | null
  previewImg: string | null
  isFullscreen: boolean
  hasNextButton: boolean
  order: number
  data: { widget: Record<string, unknown> }
}

type Ctx = { projectId: string; rundownId: string }

export const rundownOverlaysApi = createApi({
  reducerPath: 'rundownOverlaysApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['RundownOverlay'],
  endpoints: (b) => ({
    listRundownOverlays: b.query<RundownOverlay[], Ctx>({
      query: ({ projectId, rundownId }) => `/projects/${projectId}/rundowns/${rundownId}/overlays`,
      providesTags: (_r, _e, { rundownId }) => [{ type: 'RundownOverlay', id: `LIST:${rundownId}` }],
    }),
    createRundownOverlay: b.mutation<RundownOverlay, Ctx & { data: { model: string; widgetName?: string } }>({
      query: ({ projectId, rundownId, data }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/overlays`, method: 'POST', body: data,
      }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'RundownOverlay', id: `LIST:${rundownId}` }],
    }),
    updateRundownOverlay: b.mutation<RundownOverlay, Ctx & { overlayId: number; data: Record<string, unknown> }>({
      query: ({ projectId, rundownId, overlayId, data }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/overlays/${overlayId}`, method: 'PATCH', body: data,
      }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'RundownOverlay', id: `LIST:${rundownId}` }],
    }),
    deleteRundownOverlay: b.mutation<void, Ctx & { overlayId: number }>({
      query: ({ projectId, rundownId, overlayId }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/overlays/${overlayId}`, method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'RundownOverlay', id: `LIST:${rundownId}` }],
    }),
    reorderRundownOverlays: b.mutation<void, Ctx & { orderedIds: number[] }>({
      query: ({ projectId, rundownId, orderedIds }) => ({
        url: `/projects/${projectId}/rundowns/${rundownId}/overlays/reorder`, method: 'POST', body: { orderedIds },
      }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'RundownOverlay', id: `LIST:${rundownId}` }],
    }),
  }),
})

export const {
  useListRundownOverlaysQuery, useCreateRundownOverlayMutation, useUpdateRundownOverlayMutation,
  useDeleteRundownOverlayMutation, useReorderRundownOverlaysMutation,
} = rundownOverlaysApi
