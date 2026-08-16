import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function createEntityApi<TRow, TCreate, TUpdate>(config: {
  reducerPath: string
  tagType: string
  basePath: string
}) {
  const { reducerPath, tagType, basePath } = config

  const api = createApi({
    reducerPath,
    baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
    tagTypes: [tagType],
    endpoints: (b) => ({
      [`list${cap(basePath)}`]: b.query<TRow[], string>({
        query: (projectId: string) => `/projects/${projectId}/${basePath}`,
        providesTags: (_r, _e, projectId: string) => [{ type: tagType, id: `LIST:${projectId}` }],
      }),
      [`get${tagType}`]: b.query<TRow, { projectId: string; id: number }>({
        query: ({ projectId, id }) => `/projects/${projectId}/${basePath}/${id}`,
        providesTags: (_r, _e, { id }) => [{ type: tagType, id }],
      }),
      [`create${tagType}`]: b.mutation<TRow, { projectId: string; data: TCreate }>({
        query: ({ projectId, data }) => ({ url: `/projects/${projectId}/${basePath}`, method: 'POST', body: data }),
        invalidatesTags: (_r, _e, { projectId }) => [{ type: tagType, id: `LIST:${projectId}` }],
      }),
      [`update${tagType}`]: b.mutation<TRow, { projectId: string; id: string; data: TUpdate }>({
        query: ({ projectId, id, data }) => ({ url: `/projects/${projectId}/${basePath}/${id}`, method: 'PATCH', body: data }),
        invalidatesTags: (_r, _e, { projectId, id }) => [{ type: tagType, id }, { type: tagType, id: `LIST:${projectId}` }],
      }),
      [`delete${tagType}`]: b.mutation<void, { projectId: string; id: number }>({
        query: ({ projectId, id }) => ({ url: `/projects/${projectId}/${basePath}/${id}`, method: 'DELETE' }),
        invalidatesTags: (_r, _e, { projectId, id }) => [{ type: tagType, id }, { type: tagType, id: `LIST:${projectId}` }],
      }),
    }),
  })

  return { api }
}
