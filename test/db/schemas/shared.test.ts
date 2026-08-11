import { describe, it, expect } from 'vitest'
import { extraSchema } from '@/db/schemas/shared'

describe('extraSchema', () => {
  it('accepts a string-to-string map', () => {
    const result = extraSchema.parse({ jersey: '23', hometown: 'Austin' })
    expect(result).toEqual({ jersey: '23', hometown: 'Austin' })
  })

  it('defaults to an empty object when omitted', () => {
    expect(extraSchema.parse(undefined)).toEqual({})
  })

  it('rejects a non-string value', () => {
    expect(() => extraSchema.parse({ jersey: 23 })).toThrow()
  })

  it('rejects an empty-string key', () => {
    expect(() => extraSchema.parse({ '': 'x' })).toThrow()
  })
})
