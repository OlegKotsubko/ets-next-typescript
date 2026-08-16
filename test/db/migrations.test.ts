import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'db/migrations'
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')
  .toLowerCase()

describe('committed migrations (corrected baseline)', () => {
  it('create the corrected tournament + entity tables', () => {
    for (const t of ['projects', 'project_tags', 'project_favourites', 'tags', 'players',
      'player_photos', 'teams', 'team_logos', 'team_players', 'talents', 'sponsors', 'videos',
      'assets', 'themes', 'brackets', 'matches', 'seatings', 'rundowns']) {
      expect(sql).toMatch(new RegExp(`create table (if not exists )?"${t}"`))
    }
  })
  it('create the tournament_status enum and drop the invented model', () => {
    expect(sql).toMatch(/create type "public"\."tournament_status"/)
    expect(sql).not.toContain('project_mode')
    expect(sql).not.toContain('rundown_items')
    expect(sql).not.toContain('project_css')
  })
  it('does not seed a singleton project', () => {
    expect(sql).not.toContain('insert into "projects"')
  })
  it('create the four better-auth tables', () => {
    for (const t of ['users', 'sessions', 'accounts', 'verifications']) {
      expect(sql).toMatch(new RegExp(`create table (if not exists )?"${t}"`))
    }
  })
})
