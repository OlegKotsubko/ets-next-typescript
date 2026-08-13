// app/api/broadcast/[rundownId]/stream/route.ts
// Public, unauthenticated (rundown IDs are unguessable UUIDs — treated as
// share links, per docs/rundowns.md). Edge runtime is mandatory: Netlify
// Functions cap at 10s and this stream is long-lived. CLAUDE.md decision 6.
import { subscribe, getSnapshot, type BroadcastEvent, type Channel } from '@/lib/broadcast/bus'

export const runtime = 'edge'

function resolveChannel(url: string): Channel {
  return new URL(url).searchParams.get('channel') === 'air' ? 'air' : 'preview'
}

function frame(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export async function GET(req: Request, { params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = await params
  const channel = resolveChannel(req.url)
  const enc = new TextEncoder()
  let unsub: (() => void) | undefined
  let beat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      // Reload recovery: replay the current set as `show` events before anything live.
      for (const t of getSnapshot(rundownId, channel)) {
        controller.enqueue(enc.encode(frame({ type: 'show', ...t })))
      }
      unsub = subscribe(rundownId, channel, (event: BroadcastEvent) => {
        controller.enqueue(enc.encode(frame(event)))
      })
      // Keeps the Netlify CDN / corporate proxies from closing an idle connection.
      beat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': beat\n\n'))
        } catch {
          // Controller is closed/errored (client gone) but cancel() didn't
          // fire yet on this path — stop the interval ourselves so it can't
          // leak and keep firing against a dead controller forever.
          if (beat) clearInterval(beat)
        }
      }, 15000)
    },
    cancel() {
      if (beat) clearInterval(beat)
      unsub?.()
    },
  })

  // Second safety net alongside cancel(): not every disconnect path is
  // guaranteed to invoke the stream's cancel() callback. clearInterval and
  // unsub() are both safe no-ops if cancel() already ran.
  req.signal.addEventListener('abort', () => {
    if (beat) clearInterval(beat)
    unsub?.()
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' },
  })
}
