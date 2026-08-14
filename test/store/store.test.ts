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
import { projectCssApi } from '@/store/apis/projectCssApi'
import { projectsApi } from '@/store/apis/projectsApi'
import { overlayPackagesApi } from '@/store/apis/overlayPackagesApi'
import { rundownItemsApi } from '@/store/apis/rundownItemsApi'
import { titlesApi } from '@/store/apis/titlesApi'

describe('store', () => {
  it('starts with no selected item', () => {
    expect(store.getState().editor.selectedItemId).toBeNull()
  })
  it('updates selection via dispatch', () => {
    store.dispatch(setSelectedItem('abc'))
    expect(store.getState().editor.selectedItemId).toBe('abc')
  })

  it('registers all 8 entity API reducers', () => {
    const state = store.getState()
    expect(state[assetsApi.reducerPath]).toBeDefined()
    expect(state[playersApi.reducerPath]).toBeDefined()
    expect(state[talentsApi.reducerPath]).toBeDefined()
    expect(state[teamsApi.reducerPath]).toBeDefined()
    expect(state[sponsorsApi.reducerPath]).toBeDefined()
    expect(state[videosApi.reducerPath]).toBeDefined()
    expect(state[bracketsApi.reducerPath]).toBeDefined()
    expect(state[projectCssApi.reducerPath]).toBeDefined()
  })

  it('registers projectsApi and overlayPackagesApi reducers', () => {
    const state = store.getState()
    expect(state[projectsApi.reducerPath]).toBeDefined()
    expect(state[overlayPackagesApi.reducerPath]).toBeDefined()
  })

  it('registers rundownItemsApi and titlesApi reducers', () => {
    const state = store.getState()
    expect(state[rundownItemsApi.reducerPath]).toBeDefined()
    expect(state[titlesApi.reducerPath]).toBeDefined()
  })
})
