import { describe, it, expect } from 'vitest'
import {
  assets, players, talents, teams, teamPlayers, sponsors, brackets, projectCss, videos,
} from '@/db/schema'

describe('entity tables', () => {
  it('exports all 8 entity tables plus the team_players join', () => {
    expect(assets).toBeDefined()
    expect(players).toBeDefined()
    expect(talents).toBeDefined()
    expect(teams).toBeDefined()
    expect(teamPlayers).toBeDefined()
    expect(sponsors).toBeDefined()
    expect(brackets).toBeDefined()
    expect(projectCss).toBeDefined()
    expect(videos).toBeDefined()
  })
})
