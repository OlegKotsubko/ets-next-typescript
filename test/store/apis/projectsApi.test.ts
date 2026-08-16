import { describe, it, expect } from 'vitest'
import { projectsApi } from '@/store/apis/projectsApi'

describe('projectsApi', () => {
  it('exposes list + favourite endpoints and no create', () => {
    const names = Object.keys(projectsApi.endpoints)
    expect(names).toContain('listProjects')
    expect(names).toContain('setFavourite')
    expect(names).toContain('unsetFavourite')
    expect(names).not.toContain('createProject')
  })
})
