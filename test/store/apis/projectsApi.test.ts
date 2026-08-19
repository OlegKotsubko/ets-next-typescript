import { describe, it, expect } from 'vitest'
import { projectsApi } from '@/store/apis/projectsApi'

describe('projectsApi', () => {
  it('exposes list + favourite + CRUD endpoints', () => {
    const names = Object.keys(projectsApi.endpoints)
    expect(names).toContain('listProjects')
    expect(names).toContain('setFavourite')
    expect(names).toContain('unsetFavourite')
    expect(names).toEqual(expect.arrayContaining(['createProject', 'updateProject', 'deleteProject']))
  })
})
