import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RundownItem } from '@/lib/entities/rundown-items'
import type { CreateRundownItemInput, UpdateRundownItemInput } from '@/db/schemas/rundown-items'

// Items are nested under a rundown, so the createEntityApi factory (which assumes
// /projects/:id/:base) doesn't fit — this slice is hand-written.
const base = (projectId: string, rundownId: string) =>
  `/projects/${projectId}/rundowns/${rundownId}/items`

export const rundownItemsApi = createApi({
  reducerPath: 'rundownItemsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Item'],
  endpoints: (b) => ({
    listItems: b.query<RundownItem[], { projectId: string; rundownId: string }>({
      query: ({ projectId, rundownId }) => base(projectId, rundownId),
      providesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    createItem: b.mutation<RundownItem, { projectId: string; rundownId: string; data: CreateRundownItemInput }>({
      query: ({ projectId, rundownId, data }) => ({ url: base(projectId, rundownId), method: 'POST', body: data }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    updateItem: b.mutation<RundownItem, { projectId: string; rundownId: string; itemId: string; data: UpdateRundownItemInput }>({
      query: ({ projectId, rundownId, itemId, data }) => ({ url: `${base(projectId, rundownId)}/${itemId}`, method: 'PATCH', body: data }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    deleteItem: b.mutation<void, { projectId: string; rundownId: string; itemId: string }>({
      query: ({ projectId, rundownId, itemId }) => ({ url: `${base(projectId, rundownId)}/${itemId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
    reorderItems: b.mutation<RundownItem[], { projectId: string; rundownId: string; orderedIds: string[] }>({
      query: ({ projectId, rundownId, orderedIds }) => ({
        url: `${base(projectId, rundownId)}/order`, method: 'PUT', body: { orderedIds },
      }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Item', id: `LIST:${rundownId}` }],
    }),
  }),
})

export const {
  useListItemsQuery, useCreateItemMutation, useUpdateItemMutation,
  useDeleteItemMutation, useReorderItemsMutation,
} = rundownItemsApi
