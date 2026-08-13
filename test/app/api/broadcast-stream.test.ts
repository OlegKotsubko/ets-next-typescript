// test/app/api/broadcast-stream.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSnapshotMock = vi.fn()
const subscribeMock = vi.fn((..._args: unknown[]) => () => {})
vi.mock('@/lib/broadcast/bus', () => ({
  getSnapshot: (...args: unknown[]) => getSnapshotMock(...args),
  subscribe: (...args: unknown[]) => subscribeMock(...args),
}))

const { GET } = await import('@/app/api/broadcast/[rundownId]/stream/route')

function ctx(rundownId = 'r1') {
  return { params: Promise.resolve({ rundownId }) }
}

async function readChunk(res: Response) {
  const reader = res.body!.getReader()
  const { value } = await reader.read()
  await reader.cancel()
  return new TextDecoder().decode(value)
}

describe('GET /api/broadcast/[rundownId]/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSnapshotMock.mockReturnValue([])
  })

  it('sets SSE headers', async () => {
    const res = await GET(new Request('http://t/x?channel=air'), ctx())
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('replays the snapshot as show events before subscribing', async () => {
    getSnapshotMock.mockReturnValue([{ itemId: 'a', titleKey: 't', layer: 1, position: 0, data: { x: 1 } }])
    const res = await GET(new Request('http://t/x?channel=air'), ctx('r1'))
    const text = await readChunk(res)
    expect(text).toContain('"type":"show"')
    expect(text).toContain('"itemId":"a"')
    expect(getSnapshotMock).toHaveBeenCalledWith('r1', 'air')
    expect(subscribeMock).toHaveBeenCalledWith('r1', 'air', expect.any(Function))
  })

  it('defaults to the preview channel for anything other than "air"', async () => {
    await GET(new Request('http://t/x'), ctx('r1'))
    expect(getSnapshotMock).toHaveBeenCalledWith('r1', 'preview')
    await GET(new Request('http://t/x?channel=bogus'), ctx('r1'))
    expect(getSnapshotMock).toHaveBeenLastCalledWith('r1', 'preview')
  })

  it('streams a live event forwarded from subscribe', async () => {
    let deliver: ((e: unknown) => void) | undefined
    subscribeMock.mockImplementation((_rid, _ch, fn) => {
      deliver = fn as (e: unknown) => void
      return () => {}
    })
    const res = await GET(new Request('http://t/x?channel=air'), ctx('r1'))
    deliver!({ type: 'hide', itemId: 'a' })
    const text = await readChunk(res)
    expect(text).toContain('"type":"hide"')
  })

  it('sends a heartbeat comment every 15s', async () => {
    vi.useFakeTimers()
    try {
      const res = await GET(new Request('http://t/x?channel=air'), ctx('r1'))
      vi.advanceTimersByTime(15000)
      const text = await readChunk(res)
      expect(text).toBe(': beat\n\n')
    } finally {
      vi.useRealTimers()
    }
  })
})
