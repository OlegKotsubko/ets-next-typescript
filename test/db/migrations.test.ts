import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SEED_PROJECT_ID } from '@/db/constants'

const dir = 'db/migrations'
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')
  .toLowerCase()

describe('committed migrations', () => {
  it('create all three tables and the project_mode enum', () => {
    // drizzle-kit emits `CREATE TABLE IF NOT EXISTS "<name>"`.
    expect(sql).toMatch(/create table (if not exists )?"projects"/)
    expect(sql).toMatch(/create table (if not exists )?"rundowns"/)
    expect(sql).toMatch(/create table (if not exists )?"rundown_items"/)
    expect(sql).toMatch(/create type "public"\."project_mode"/)
  })
  it('seed the singleton project at SEED_PROJECT_ID', () => {
    expect(sql).toContain('insert into "projects"')
    expect(sql).toContain(SEED_PROJECT_ID.toLowerCase())
  })
})
