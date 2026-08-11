import { describe, it, expect } from 'vitest'
import { OpeningTimerFields, OpeningTimerActions } from '@/models/OpeningTimer'
import { LowerThirdFields, LowerThirdActions } from '@/models/LowerThird'

describe('OpeningTimerFields', () => {
  it('accepts a full valid payload', () => {
    const r = OpeningTimerFields.safeParse({
      hours: 1,
      minutes: 30,
      seconds: 0,
      main_text: 'Kickoff',
      sponsors: ['Acme'],
    })
    expect(r.success).toBe(true)
  })

  it('defaults sponsors to an empty array', () => {
    const parsed = OpeningTimerFields.parse({ hours: 0, minutes: 5, seconds: 0, main_text: 'Soon' })
    expect(parsed.sponsors).toEqual([])
  })

  it('rejects minutes above 59', () => {
    expect(OpeningTimerFields.safeParse({ hours: 0, minutes: 60, seconds: 0, main_text: 'x' }).success).toBe(false)
  })

  it('rejects a non-integer hour', () => {
    expect(OpeningTimerFields.safeParse({ hours: 1.5, minutes: 0, seconds: 0, main_text: 'x' }).success).toBe(false)
  })

  it('declares start/stop/reset as its command actions', () => {
    expect(OpeningTimerActions).toEqual(['start', 'stop', 'reset'])
  })
})

describe('LowerThirdFields', () => {
  it('requires a player name', () => {
    expect(LowerThirdFields.safeParse({ teamName: 'Boom Squad' }).success).toBe(false)
  })

  it('accepts name only', () => {
    expect(LowerThirdFields.safeParse({ playerName: 'Casey Liu' }).success).toBe(true)
  })

  it('declares no command actions', () => {
    expect(LowerThirdActions).toEqual([])
  })
})

describe('composition', () => {
  it('supports the per-project omit/extend pattern', () => {
    const composed = OpeningTimerFields.omit({ sponsors: true }).extend({
      subtitle: LowerThirdFields.shape.teamName,
    })
    const r = composed.safeParse({ hours: 0, minutes: 1, seconds: 2, main_text: 'x', subtitle: 'y' })
    expect(r.success).toBe(true)
    expect(Object.keys(composed.shape)).not.toContain('sponsors')
  })
})
