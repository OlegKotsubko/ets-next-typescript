import { describe, it, expect, beforeEach } from 'vitest'
import {
  publish, subscribe, getSnapshot, resetBus,
} from '@/lib/broadcast/bus'
import type { OverlayPayload } from '@/lib/broadcast/types'

const ov: OverlayPayload = {
  id: 1, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}

describe('broadcast bus', () => {
  beforeEach(() => resetBus())

  it('delivers events to subscribers of the same key', () => {
    const seen: string[] = []
    subscribe('u1', 'air', (e) => seen.push(e.type))
    publish('u1', 'air', { type: 'air', data: [ov] })
    expect(seen).toEqual(['air'])
  })
  it('does not cross channels or uuids', () => {
    const seen: string[] = []
    subscribe('u1', 'preview', (e) => seen.push(e.type))
    publish('u1', 'air', { type: 'air', data: [ov] })
    publish('u2', 'preview', { type: 'air', data: [ov] })
    expect(seen).toEqual([])
  })
  it('keeps a snapshot reduced from events (for replay)', () => {
    publish('u1', 'air', { type: 'air', data: [ov] })
    expect(getSnapshot('u1', 'air').map((o) => o.id)).toEqual([1])
    publish('u1', 'air', { type: 'hide_all' })
    expect(getSnapshot('u1', 'air')).toEqual([])
  })
  it('unsubscribe stops delivery', () => {
    const seen: string[] = []
    const off = subscribe('u1', 'air', (e) => seen.push(e.type))
    off()
    publish('u1', 'air', { type: 'hide_all' })
    expect(seen).toEqual([])
  })
})
