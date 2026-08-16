import { describe, it, expect } from 'vitest'
import * as schema from '@/db/schema'

describe('schema', () => {
  it('exposes the corrected tournament + entity tables', () => {
    for (const t of ['projects', 'projectTags', 'projectFavourites', 'tags', 'players',
      'playerPhotos', 'teams', 'teamLogos', 'teamPlayers', 'talents', 'sponsors', 'videos',
      'assets', 'themes', 'brackets', 'matches', 'seatings', 'rundowns']) {
      expect(schema).toHaveProperty(t)
    }
  })
  it('keeps the four better-auth tables', () => {
    for (const t of ['users', 'sessions', 'accounts', 'verifications']) {
      expect(schema).toHaveProperty(t)
    }
  })
  it('reshapes projects to the tournament model', () => {
    const cols = Object.keys(schema.projects)
    expect(cols).toContain('title')
    expect(cols).toContain('status')
    expect(cols).toContain('disciplineId')
    expect(cols).not.toContain('mode')
    expect(cols).not.toContain('label')
  })
})
