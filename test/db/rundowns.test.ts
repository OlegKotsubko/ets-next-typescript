import { describe, it, expect } from 'vitest'
import { getTableName, getTableColumns } from 'drizzle-orm'
import { rundowns, rundownItems } from '@/db/schema'

describe('rundowns table', () => {
  it('is named "rundowns" with owner + project columns', () => {
    expect(getTableName(rundowns)).toBe('rundowns')
    const cols = Object.keys(getTableColumns(rundowns))
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'projectId', 'name', 'ownerId', 'createdAt', 'updatedAt']),
    )
  })
})

describe('rundown_items table', () => {
  it('is named "rundown_items" with the jsonb data + label + position columns', () => {
    expect(getTableName(rundownItems)).toBe('rundown_items')
    const cols = Object.keys(getTableColumns(rundownItems))
    expect(cols).toEqual(
      expect.arrayContaining([
        'id', 'rundownId', 'projectId', 'titleKey', 'label', 'position', 'data',
      ]),
    )
  })
  it('does NOT yet have a layer column (deferred to the multi-layer plan)', () => {
    const cols = Object.keys(getTableColumns(rundownItems))
    expect(cols).not.toContain('layer')
  })
})
