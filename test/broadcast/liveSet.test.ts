import { describe, it, expect } from 'vitest'
import { applyEvent, sortLiveSet, type LiveTitle } from '@/lib/broadcast/liveSet'

const lt = (itemId: string, layer: number, position = 0): LiveTitle => ({
  itemId, titleKey: 't', layer, position, data: {},
})

describe('applyEvent', () => {
  it('show adds an entry without mutating the input map', () => {
    const m0 = new Map<string, LiveTitle>()
    const m1 = applyEvent(m0, { type: 'show', itemId: 'a', titleKey: 't', layer: 1, position: 0, data: { x: 1 } })
    expect(m0.size).toBe(0)
    expect(m1.get('a')).toMatchObject({ layer: 1, data: { x: 1 } })
  })

  it('hide removes the entry', () => {
    const m1 = applyEvent(new Map([['a', lt('a', 1)]]), { type: 'hide', itemId: 'a' })
    expect(m1.has('a')).toBe(false)
  })

  it('update merges layer/position/data onto an existing entry', () => {
    const m1 = applyEvent(
      new Map([['a', lt('a', 1)]]),
      { type: 'update', itemId: 'a', layer: 5, position: 2, data: { y: 9 } },
    )
    expect(m1.get('a')).toMatchObject({ layer: 5, position: 2, data: { y: 9 } })
  })

  it('update on an absent entry is a no-op', () => {
    const m1 = applyEvent(new Map(), { type: 'update', itemId: 'ghost', layer: 5, position: 0, data: {} })
    expect(m1.size).toBe(0)
  })

  it('command does not alter the set', () => {
    const m0 = new Map([['a', lt('a', 1)]])
    const m1 = applyEvent(m0, { type: 'command', itemId: 'a', action: 'start' })
    expect([...m1.entries()]).toEqual([...m0.entries()])
  })
})

describe('sortLiveSet', () => {
  it('orders by layer asc then position asc', () => {
    const m = new Map([['a', lt('a', 2, 0)], ['b', lt('b', 0, 1)], ['c', lt('c', 0, 0)]])
    expect(sortLiveSet(m).map((t) => t.itemId)).toEqual(['c', 'b', 'a'])
  })

  it('returns an empty array for an empty map', () => {
    expect(sortLiveSet(new Map())).toEqual([])
  })
})
