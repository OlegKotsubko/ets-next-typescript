import { describe, it, expect } from 'vitest'
import { listCategories, listOverlays } from '@/lib/overlays/catalog'

describe('catalog packs API', () => {
  it('listCategories returns distinct sorted categories', () => {
    const cats = listCategories()
    expect(cats).toContain('general')
    expect([...cats]).toEqual([...cats].sort())
    expect(new Set(cats).size).toBe(cats.length)
  })
  it('listOverlays returns only overlays whose category is in the pack list', () => {
    const res = listOverlays(['general'])
    expect(res.length).toBeGreaterThan(0)
    expect(res.every((e) => e.category === 'general')).toBe(true)
  })
  it('empty packs => empty list (no general fallback)', () => {
    expect(listOverlays([])).toEqual([])
  })
  it('unknown pack => empty', () => {
    expect(listOverlays(['does-not-exist'])).toEqual([])
  })
})
