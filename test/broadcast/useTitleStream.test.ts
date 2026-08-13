import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'

class FakeES {
  static last: FakeES | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  url: string
  constructor(url: string) { this.url = url; FakeES.last = this }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

beforeEach(() => { vi.stubGlobal('EventSource', FakeES as unknown as typeof EventSource) })

describe('useTitleStream', () => {
  it('accumulates shows into a layer-sorted set and drops on hide', () => {
    const { result } = renderHook(() => useTitleStream('r1', 'air'))
    expect(result.current).toEqual([])

    act(() => FakeES.last!.emit({ type: 'show', itemId: 'a', titleKey: 't', layer: 2, position: 0, data: {} }))
    act(() => FakeES.last!.emit({ type: 'show', itemId: 'b', titleKey: 't', layer: 0, position: 0, data: {} }))
    expect(result.current.map((t) => t.itemId)).toEqual(['b', 'a'])

    act(() => FakeES.last!.emit({ type: 'hide', itemId: 'a' }))
    expect(result.current.map((t) => t.itemId)).toEqual(['b'])
  })

  it('subscribes to the channel-specific URL', () => {
    renderHook(() => useTitleStream('r1', 'preview'))
    expect(FakeES.last!.url).toContain('channel=preview')
  })
})
