// test/broadcast/integration.test.tsx
// Exercises the real bus -> real SSE route -> (simulated wire, since jsdom
// has no EventSource) -> real hook -> real renderer -> real title component.
// Task 4 separately proves the route's output is well-formed SSE text; this
// test proves that text, once received, ends up as pixels.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { publish } from '@/lib/broadcast/bus'
import { GET } from '@/app/api/broadcast/[rundownId]/stream/route'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'

class FakeES {
  static last: FakeES | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  constructor(public url: string) { FakeES.last = this }
  close() {}
  emit(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

beforeEach(() => { vi.stubGlobal('EventSource', FakeES as unknown as typeof EventSource) })

async function readOneFrame(res: Response) {
  const reader = res.body!.getReader()
  const { value } = await reader.read()
  await reader.cancel()
  return new TextDecoder().decode(value)
}

function Air({ rundownId }: { rundownId: string }) {
  const titles = useTitleStream(rundownId, 'air')
  return <TitleRenderer titles={titles}
    packageLabel="default" />
}

describe('broadcast integration: publish -> renders on air', () => {
  it('a published show event ends up rendered by the real title component', async () => {
    const rundownId = `integration-${Date.now()}`
    publish(rundownId, 'air', {
      type: 'show', itemId: 'i1', titleKey: 'lower-third', layer: 0, position: 0,
      data: { playerName: 'Casey Liu', teamName: 'Boom Squad' },
    })

    // Real SSE route, reading the real bus snapshot for this rundown.
    const res = await GET(new Request('http://t/x?channel=air'), { params: Promise.resolve({ rundownId }) })
    const text = await readOneFrame(res)
    const event = JSON.parse(text.replace(/^data: /, '').trim())
    expect(event).toMatchObject({ type: 'show', itemId: 'i1', titleKey: 'lower-third' })

    // Feed that exact wire payload into the real hook via a fake transport.
    render(<Air rundownId={rundownId} />)
    act(() => FakeES.last!.emit(event))

    expect(await screen.findByText('Casey Liu')).toBeInTheDocument()
  })
})
