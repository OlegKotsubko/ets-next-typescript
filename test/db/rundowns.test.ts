import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { rundowns } from '@/db/schema'

describe('rundowns table (reshaped)', () => {
  it('has the corrected columns', () => {
    const cols = Object.keys(getTableColumns(rundowns))
    expect(cols).toEqual(expect.arrayContaining(['id', 'projectId', 'userId', 'name', 'image']))
    // ownerId was renamed to userId
    expect(cols).not.toContain('ownerId')
  })
  it('keys by an integer id', () => {
    expect(getTableColumns(rundowns).id.columnType).toBe('PgSerial')
  })
})
