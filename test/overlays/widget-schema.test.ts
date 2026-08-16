import { describe, it, expect } from 'vitest'
import { defineWidget, text, number, select, checkbox } from '@/lib/overlays/widget-schema'

describe('widget-schema DSL', () => {
  const { model, fields } = defineWidget({
    text: text({ default: 'x', canLiveUpdate: true }),
    n: number({ required: true }),
    pick: select({ choices: [['a', 'A'], ['b', 'B']], default: 'a' }),
    on: checkbox({ default: false }),
  })
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]))

  it('coerces and validates via the Zod model', () => {
    const parsed = model.parse({ n: '3', pick: 'a' }) as Record<string, unknown>
    expect(parsed).toMatchObject({ text: 'x', n: 3, pick: 'a', on: false })
    expect(typeof parsed.n).toBe('number')
  })

  it('rejects an out-of-enum select value', () => {
    expect(model.safeParse({ n: 1, pick: 'z' }).success).toBe(false)
  })

  it('rejects a missing required field', () => {
    expect(model.safeParse({ pick: 'a' }).success).toBe(false) // n missing
  })

  it('produces descriptors with humanized labels + metadata', () => {
    expect(byName.text).toMatchObject({ input_type: 'text', label: 'Text', can_live_update: true, default: 'x' })
    expect(byName.n).toMatchObject({ input_type: 'number', required: true, can_live_update: false })
    expect(byName.pick).toMatchObject({ input_type: 'select', choices: [['a', 'A'], ['b', 'B']], default: 'a' })
    expect(byName.on.input_type).toBe('checkbox')
  })
})
