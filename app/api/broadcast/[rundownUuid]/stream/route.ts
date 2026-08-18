import { getSnapshot, subscribe } from '@/lib/broadcast/bus'
import type { BroadcastEvent, Channel } from '@/lib/broadcast/types'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ rundownUuid: string }> }) {
  const { rundownUuid } = await params
  const channel: Channel = new URL(req.url).searchParams.get('channel') === 'air' ? 'air' : 'preview'

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (type: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      // Replay the current set as one channel event, then stream live ones.
      send(channel, getSnapshot(rundownUuid, channel))
      const unsub = subscribe(rundownUuid, channel, (e: BroadcastEvent) => {
        send(e.type, 'data' in e ? e.data : {})
      })
      req.signal.addEventListener('abort', () => {
        unsub()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
