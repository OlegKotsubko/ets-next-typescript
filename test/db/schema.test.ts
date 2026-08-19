import { describe, it, expect } from 'vitest'
import * as schema from '@/db/schema'

describe('schema', () => {
  it('exposes the corrected tournament + entity tables', () => {
    for (const t of ['projects', 'projectFavourites', 'players',
      'playerPhotos', 'teams', 'teamLogos', 'teamPlayers', 'talents', 'sponsors', 'videos',
      'assets', 'themes', 'brackets', 'matches', 'seatings', 'rundowns']) {
      expect(schema).toHaveProperty(t)
    }
  })
  it('drops the tags/disciplines model', () => {
    expect(schema).not.toHaveProperty('tags')
    expect(schema).not.toHaveProperty('projectTags')
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
    expect(cols).toContain('overlayPacks')
    expect(cols).not.toContain('disciplineId')
    expect(cols).not.toContain('heroSectionUrl')
    expect(cols).not.toContain('mode')
    expect(cols).not.toContain('label')
  })
})
