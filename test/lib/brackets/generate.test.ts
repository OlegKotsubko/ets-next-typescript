import { describe, it, expect } from 'vitest'
import { generateSingleElim } from '@/lib/brackets/generate'

describe('generateSingleElim', () => {
  it('4 participants -> 1 Semifinal round of 2 + 1 Final', () => {
    const rounds = generateSingleElim(4)
    expect(rounds.map((r) => r.name)).toEqual(['Semifinal', 'Final'])
    expect(rounds[0].matches).toHaveLength(2)
    expect(rounds[1].matches).toHaveLength(1)
  })

  it('8 participants -> Quarterfinal(4), Semifinal(2), Final(1)', () => {
    const rounds = generateSingleElim(8)
    expect(rounds.map((r) => r.name)).toEqual(['Quarterfinal', 'Semifinal', 'Final'])
    expect(rounds[0].matches).toHaveLength(4)
  })

  it('16 participants -> Round of 16(8), Quarterfinal(4), Semifinal(2), Final(1)', () => {
    const rounds = generateSingleElim(16)
    expect(rounds.map((r) => r.name)).toEqual(['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'])
  })

  it('every generated match starts empty and scheduled', () => {
    const rounds = generateSingleElim(2)
    const match = rounds[0].matches[0]
    expect(match.status).toBe('scheduled')
    expect(match.leftParticipantId).toBeNull()
    expect(match.rightParticipantId).toBeNull()
    expect(match.scoreLeft).toBe(0)
    expect(match.scoreRight).toBe(0)
    expect(match.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})
