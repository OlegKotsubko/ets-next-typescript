import { describe, it, expect, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { createEntityApi } from '@/store/apis/createEntityApi'

type Widget = { id: string; projectId: string; name: string }

describe('createEntityApi', () => {
  it('builds list/get/create/update/delete endpoints with project-scoped tags', () => {
    const { api } = createEntityApi<Widget, { name: string }, { name?: string }>({
      reducerPath: 'widgetsApi',
      tagType: 'Widget',
      basePath: 'widgets',
    })
    expect(api.reducerPath).toBe('widgetsApi')
    expect(Object.keys(api.endpoints)).toEqual(
      expect.arrayContaining(['listWidgets', 'getWidget', 'createWidget', 'updateWidget', 'deleteWidget']),
    )
  })

  it('the list query attempts the correct relative URL', async () => {
    const { api } = createEntityApi<Widget, { name: string }, { name?: string }>({
      reducerPath: 'widgetsApi',
      tagType: 'Widget',
      basePath: 'widgets',
    })
    const store = configureStore({
      reducer: { [api.reducerPath]: api.reducer },
      middleware: (gd) => gd().concat(api.middleware),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await store.dispatch((api.endpoints as any).listWidgets.initiate('proj-1'))

    // No real network/base URL in this test environment, so the request itself fails —
    // but the failure surfaces the exact URL fetchBaseQuery attempted, proving basePath
    // interpolation is correct without needing a live fetch mock.
    expect(JSON.stringify(result.error)).toContain('/api/projects/proj-1/widgets')
  })

  it('a second instance with a different basePath keeps the naming convention', () => {
    const { api: playersApi } = createEntityApi<Widget, { name: string }, { name?: string }>({
      reducerPath: 'playersApiTest',
      tagType: 'Player',
      basePath: 'players',
    })
    expect(Object.keys(playersApi.endpoints)).toEqual(
      expect.arrayContaining(['listPlayers', 'getPlayer', 'createPlayer', 'updatePlayer', 'deletePlayer']),
    )
  })
})
