import { describe, it, expect, vi } from 'vitest'
import { publish, subscribe, getSnapshot } from '@/lib/broadcast/bus'

// Bus state is module-level (in-process); give every test its own rundownId
// so runs can't bleed into each other.
let n = 0
const rid = () => `r${++n}`

describe('bus', () => {
  it('delivers published events to subscribers on the same (rundownId, channel)', () => {
    const id = rid()
    const fn = vi.fn()
    subscribe(id, 'air', fn)
    const event = { type: 'show', itemId: 'a', titleKey: 't', layer: 0, position: 0, data: {} } as const
    publish(id, 'air', event)
    expect(fn).toHaveBeenCalledWith(event)
  })

  it('does not deliver to a subscriber on a different channel or rundown', () => {
    const id = rid()
    const airFn = vi.fn()
    const previewFn = vi.fn()
    const otherRundownFn = vi.fn()
    subscribe(id, 'air', airFn)
    subscribe(id, 'preview', previewFn)
    subscribe(rid(), 'air', otherRundownFn)
    publish(id, 'air', { type: 'hide', itemId: 'a' })
    expect(airFn).toHaveBeenCalledTimes(1)
    expect(previewFn).not.toHaveBeenCalled()
    expect(otherRundownFn).not.toHaveBeenCalled()
  })

  it('unsubscribe stops further delivery', () => {
    const id = rid()
    const fn = vi.fn()
    const unsub = subscribe(id, 'air', fn)
    unsub()
    publish(id, 'air', { type: 'hide', itemId: 'a' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('accumulates show/hide into the snapshot and returns it sorted', () => {
    const id = rid()
    publish(id, 'air', { type: 'show', itemId: 'a', titleKey: 't', layer: 2, position: 0, data: {} })
    publish(id, 'air', { type: 'show', itemId: 'b', titleKey: 't', layer: 0, position: 0, data: {} })
    publish(id, 'air', { type: 'hide', itemId: 'a' })
    expect(getSnapshot(id, 'air').map((t) => t.itemId)).toEqual(['b'])
  })

  it('isolates snapshots by channel and rundown', () => {
    const id = rid()
    publish(id, 'preview', { type: 'show', itemId: 'p', titleKey: 't', layer: 0, position: 0, data: {} })
    expect(getSnapshot(id, 'air')).toEqual([])
    expect(getSnapshot(id, 'preview').map((t) => t.itemId)).toEqual(['p'])
  })

  it('a command event reaches subscribers but never enters the snapshot', () => {
    const id = rid()
    const fn = vi.fn()
    subscribe(id, 'air', fn)
    publish(id, 'air', { type: 'show', itemId: 'a', titleKey: 't', layer: 0, position: 0, data: {} })
    publish(id, 'air', { type: 'command', itemId: 'a', action: 'start' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(getSnapshot(id, 'air').map((t) => t.itemId)).toEqual(['a'])
  })
})
