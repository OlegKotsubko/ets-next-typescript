import { describe, it, expect } from 'vitest'
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

  it('registers the reducer under the configured store key', () => {
    const { api } = createEntityApi<Widget, { name: string }, { name?: string }>({
      reducerPath: 'widgetsApi',
      tagType: 'Widget',
      basePath: 'widgets',
    })
    const store = configureStore({
      reducer: { [api.reducerPath]: api.reducer },
      middleware: (gd) => gd().concat(api.middleware),
    })
    expect(store.getState()[api.reducerPath]).toBeDefined()
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
