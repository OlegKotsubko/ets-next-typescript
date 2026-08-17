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

  const set = upsertById(getSnapshot(display.uuid, 'preview'), toOverlayPayload(overlay))
  publish(display.uuid, 'preview', { type: 'preview', data: set })
  return new Response(null, { status: 200 })
}
