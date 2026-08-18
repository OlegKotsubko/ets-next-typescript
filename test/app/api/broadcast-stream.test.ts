// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/broadcast/[rundownUuid]/stream/route'
import { publish, resetBus } from '@/lib/broadcast/bus'
import type { OverlayPayload } from '@/lib/broadcast/types'

const ov: OverlayPayload = {
  id: 1, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}
const P = (rundownUuid: string) => ({ params: Promise.resolve({ rundownUuid }) })

describe('GET broadcast stream', () => {
  beforeEach(() => resetBus())

  it('is an event-stream that replays the current snapshot on connect', async () => {
    publish('u1', 'air', { type: 'air', data: [ov] })
    const req = new Request('http://localhost/api/broadcast/u1/stream?channel=air')
    const res = await GET(req, P('u1'))
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('event: air')
    expect(text).toContain('"id":1')
    await reader.cancel()
  })
})
