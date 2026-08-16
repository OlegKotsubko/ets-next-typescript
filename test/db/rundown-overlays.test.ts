import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTableColumns } from 'drizzle-orm'
import { rundownOverlays } from '@/db/schema'

describe('rundown_overlays table', () => {
  it('has the placed-overlay columns incl. inline data', () => {
    const cols = Object.keys(getTableColumns(rundownOverlays))
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'rundownId', 'projectId', 'model', 'category', 'template', 'widgetName',
      'layer', 'color', 'displayFilter', 'isFullscreen', 'hasNextButton', 'order', 'data',
    ]))
  })
  it('keys by an integer id', () => {
    expect(getTableColumns(rundownOverlays).id.columnType).toBe('PgSerial')
  })
  it('is present in a committed migration', () => {
    const sql = readdirSync('db/migrations')
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join('db/migrations', f), 'utf8'))
      .join('\n')
      .toLowerCase()
    expect(sql).toMatch(/create table (if not exists )?"rundown_overlays"/)
  })
})
