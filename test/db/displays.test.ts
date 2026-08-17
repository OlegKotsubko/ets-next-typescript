import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { displays, settings } from '@/db/schema'

describe('displays + settings tables', () => {
  it('displays has uuid/name/projectId', () => {
    const cols = Object.keys(getTableColumns(displays))
    expect(cols).toEqual(expect.arrayContaining(['id', 'uuid', 'name', 'projectId', 'createdAt']))
  })
  it('settings is keyed by userId with a displayId', () => {
    const cols = Object.keys(getTableColumns(settings))
    expect(cols).toEqual(expect.arrayContaining(['userId', 'displayId']))
  })
  it('a committed migration creates both tables', () => {
    const sql = readdirSync('db/migrations').filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join('db/migrations', f), 'utf8')).join('\n').toLowerCase()
    expect(sql).toMatch(/create table (if not exists )?"displays"/)
    expect(sql).toMatch(/create table (if not exists )?"settings"/)
  })
})
