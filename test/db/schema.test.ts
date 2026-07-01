import { describe, it, expect } from 'vitest'
import { getTableName, getTableColumns } from 'drizzle-orm'
import { projects, createProjectSchema } from '@/db/schema'

describe('projects table', () => {
  it('is named "projects"', () => {
    expect(getTableName(projects)).toBe('projects')
  })
  it('has the documented columns', () => {
    const cols = Object.keys(getTableColumns(projects))
    expect(cols).toEqual(
      expect.arrayContaining([
        'id', 'name', 'mode', 'label', 'pictureUrl', 'eventDate', 'createdAt', 'updatedAt',
      ]),
    )
  })
})

describe('createProjectSchema', () => {
  it('accepts a valid project and forbids an id/projectId', () => {
    const r = createProjectSchema.safeParse({ name: 'Cup', mode: 'team_vs_team', label: 'default' })
    expect(r.success).toBe(true)
  })
  it('rejects an unknown mode', () => {
    const r = createProjectSchema.safeParse({ name: 'Cup', mode: 'nope', label: 'default' })
    expect(r.success).toBe(false)
  })
})
