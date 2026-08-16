import { describe, it, expect } from 'vitest'
import { store } from '@/store'
import { setSelectedItem } from '@/store/editorSlice'
import { assetsApi } from '@/store/apis/assetsApi'
import { playersApi } from '@/store/apis/playersApi'
import { talentsApi } from '@/store/apis/talentsApi'
import { teamsApi } from '@/store/apis/teamsApi'
import { sponsorsApi } from '@/store/apis/sponsorsApi'
import { videosApi } from '@/store/apis/videosApi'
import { bracketsApi } from '@/store/apis/bracketsApi'
import { projectsApi } from '@/store/apis/projectsApi'
import { rundownsApi } from '@/store/apis/rundownsApi'

describe('store', () => {
  it('starts with no selected item', () => {
    expect(store.getState().editor.selectedItemId).toBeNull()
  })
  it('updates selection via dispatch', () => {
    store.dispatch(setSelectedItem('abc'))
    expect(store.getState().editor.selectedItemId).toBe('abc')
  })

  it('registers the surviving entity + tournament API reducers', () => {
    const state = store.getState()
    for (const api of [assetsApi, playersApi, talentsApi, teamsApi, sponsorsApi,
      videosApi, bracketsApi, projectsApi, rundownsApi]) {
      expect(state[api.reducerPath]).toBeDefined()
    }
  })
})
