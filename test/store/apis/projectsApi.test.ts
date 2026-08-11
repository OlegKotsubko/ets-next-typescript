import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { projectsApi } from '@/store/apis/projectsApi'

describe('projectsApi', () => {
  it('exposes listProjects and createProject endpoints', () => {
    expect(Object.keys(projectsApi.endpoints)).toEqual(
      expect.arrayContaining(['listProjects', 'createProject']),
    )
  })

  it('registers its reducer under the configured store key', () => {
    const store = configureStore({
      reducer: { [projectsApi.reducerPath]: projectsApi.reducer },
      middleware: (gd) => gd().concat(projectsApi.middleware),
    })
    expect(store.getState()[projectsApi.reducerPath]).toBeDefined()
  })
})
