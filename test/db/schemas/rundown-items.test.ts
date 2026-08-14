// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createRundownItemSchema, updateRundownItemSchema, reorderRundownItemsSchema } from '@/db/schemas/rundown-items'

describe('rundown-item schemas', () => {
  it('create requires titleKey and defaults data to {}', () => {
    const r = createRundownItemSchema.safeParse({ titleKey: 'lower-third' })
    expect(r.success).toBe(true)
    expect(r.success && r.data.data).toEqual({})
  })
  it('create rejects empty titleKey', () => {
    expect(createRundownItemSchema.safeParse({ titleKey: '' }).success).toBe(false)
  })
  it('update allows label and data independently', () => {
    expect(updateRundownItemSchema.safeParse({ label: 'x' }).success).toBe(true)
    expect(updateRundownItemSchema.safeParse({ data: { a: 1 } }).success).toBe(true)
  })
  it('reorder requires a non-empty uuid array', () => {
    expect(reorderRundownItemsSchema.safeParse({ orderedIds: [] }).success).toBe(false)
    expect(reorderRundownItemsSchema.safeParse({ orderedIds: ['11111111-1111-1111-1111-111111111111'] }).success).toBe(true)
  })
})
