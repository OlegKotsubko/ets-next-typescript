// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { describeModel, computeDefaults } from '@/lib/titles/describeModel'
import { LowerThirdFields } from '@/models/LowerThird'

const model = z.object({
  playerName: z.string().min(1).max(40),
  teamName: z.string().max(40).optional(),
  position: z.enum(['guard', 'forward', 'center']).optional(),
  hours: z.number().int().min(0).max(99),
  bio: z.string().max(400),
  sponsors: z.array(z.string()).default([]),
  flag: z.boolean().optional(),
})

describe('describeModel', () => {
  const byName = Object.fromEntries(describeModel(model).map((f) => [f.name, f]))

  it('maps a bounded required string', () => {
    expect(byName.playerName).toMatchObject({ kind: 'string', required: true, minLength: 1, maxLength: 40, label: 'Player Name', multiline: false })
  })
  it('marks optional() fields not required', () => {
    expect(byName.teamName.required).toBe(false)
  })
  it('maps enum to options', () => {
    expect(byName.position).toMatchObject({ kind: 'enum', options: ['guard', 'forward', 'center'] })
  })
  it('maps int number with bounds', () => {
    expect(byName.hours).toMatchObject({ kind: 'number', int: true, min: 0, max: 99 })
  })
  it('sets multiline for long strings (maxLength > 60 or unset)', () => {
    expect(byName.bio.multiline).toBe(true)
  })
  it('maps array<string> and default() as not required', () => {
    expect(byName.sponsors).toMatchObject({ kind: 'stringArray', required: false })
  })
  it('maps boolean', () => {
    expect(byName.flag).toMatchObject({ kind: 'boolean', required: false })
  })
})

describe('computeDefaults', () => {
  it('gives every described field a controlled default', () => {
    const d = computeDefaults(LowerThirdFields)
    expect(d.playerName).toBe('')       // required string
    expect(d.position).toBe('guard')    // enum → first option
    expect(d.teamName).toBe('')         // optional string still controlled
  })
})
