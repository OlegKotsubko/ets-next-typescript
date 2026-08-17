import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { publish } from '@/lib/broadcast/bus'
import { describeModel } from '@/lib/overlays/catalog'

export const runtime = 'nodejs'

// Publishes a live_update on BOTH channels (an overlay may be on preview and/or
// air); the renderer merges by id where present. Only can_live_update fields pass.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { overlayId, widget } = await req.json() as { overlayId: number; widget: Record<string, unknown> }

  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const liveFields = new Set(describeModel(overlay.model).filter((f) => f.can_live_update).map((f) => f.name))
  const filtered = Object.fromEntries(Object.entries(widget).filter(([k]) => liveFields.has(k)))
  const data = { id: Number(overlayId), widget: filtered }
  publish(display.uuid, 'preview', { type: 'live_update', data })
  publish(display.uuid, 'air', { type: 'live_update', data })
  return new Response(null, { status: 200 })
}
