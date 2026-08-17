import { describe, it, expect } from 'vitest'
import {
  applyEvent, upsertById, sortByLayer, filterByDisplay,
} from '@/lib/broadcast/liveReducer'
import type { OverlayPayload } from '@/lib/broadcast/types'

function ov(id: number, over: Partial<OverlayPayload> = {}): OverlayPayload {
  return {
    id, model: 'general-text', category: 'general', template: 'Text', layer: 1,
    displayFilter: null, isFullscreen: false, data: { widget: { text: `t${id}` } }, ...over,
  }
}

describe('liveReducer', () => {
  it('air/preview replace the whole set', () => {
    const next = applyEvent([ov(1)], { type: 'air', data: [ov(2), ov(3)] })
    expect(next.map((o) => o.id)).toEqual([2, 3])
  })
  it('hide removes one by id', () => {
    expect(applyEvent([ov(1), ov(2)], { type: 'hide', data: { id: 1 } }).map((o) => o.id)).toEqual([2])
  })
  it('hide_all clears', () => {
    expect(applyEvent([ov(1), ov(2)], { type: 'hide_all' })).toEqual([])
  })
  it('live_update merges data.widget by id', () => {
    const next = applyEvent([ov(1)], { type: 'live_update', data: { id: 1, widget: { text: 'new' } } })
    expect(next[0].data.widget).toEqual({ text: 'new' })
  })
  it('upsertById replaces an existing id, else appends', () => {
    expect(upsertById([ov(1)], ov(1, { layer: 5 }))[0].layer).toBe(5)
    expect(upsertById([ov(1)], ov(2)).map((o) => o.id)).toEqual([1, 2])
  })
  it('sortByLayer sorts ascending', () => {
    expect(sortByLayer([ov(1, { layer: 3 }), ov(2, { layer: 1 })]).map((o) => o.id)).toEqual([2, 1])
  })
  it('filterByDisplay: no filter shows only empty display_filter', () => {
    const set = [ov(1, { displayFilter: null }), ov(2, { displayFilter: '2' }), ov(3, { displayFilter: '' })]
    expect(filterByDisplay(set, null).map((o) => o.id)).toEqual([1, 3])
    expect(filterByDisplay(set, '2').map((o) => o.id)).toEqual([2])
  })
})
