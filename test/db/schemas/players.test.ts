import { describe, it, expect } from 'vitest'
import { createPlayerSchema } from '@/db/schemas/players'

describe('createPlayerSchema', () => {
  it('accepts a minimal valid player', () => {
    const result = createPlayerSchema.parse({ name: 'Alex' })
    expect(result.name).toBe('Alex')
    expect(result.extra).toEqual({})
  })

  it('rejects a missing name', () => {
    expect(() => createPlayerSchema.parse({})).toThrow()
  })

  it('rejects a non-uuid avatarAssetId', () => {
    expect(() => createPlayerSchema.parse({ name: 'Alex', avatarAssetId: 'not-a-uuid' })).toThrow()
  })
})
