import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { getSnapshot, publish } from '@/lib/broadcast/bus'
import { upsertById } from '@/lib/broadcast/liveReducer'
import { toOverlayPayload } from '@/lib/broadcast/payload'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { overlayId } = await req.json() as { overlayId: number }

  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const payload = toOverlayPayload(overlay)
  // Full-screen take clears the current air set first (the take rule).
  const base = payload.isFullscreen ? [] : getSnapshot(display.uuid, 'air')
  publish(display.uuid, 'air', { type: 'air', data: upsertById(base, payload) })
  return new Response(null, { status: 200 })
}
