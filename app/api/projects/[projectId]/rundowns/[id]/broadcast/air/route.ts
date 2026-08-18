import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { getSnapshot, publish } from '@/lib/broadcast/bus'
import { upsertById } from '@/lib/broadcast/liveReducer'
import { toOverlayPayload } from '@/lib/broadcast/payload'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const { overlayId } = await req.json() as { overlayId: number }

  const [rundown] = await db.select().from(rundowns).where(eq(rundowns.id, Number(id)))
  if (!rundown) return Response.json({ error: 'Rundown not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const payload = toOverlayPayload(overlay)
  // Full-screen take clears the current air set first (the take rule).
  const base = payload.isFullscreen ? [] : getSnapshot(rundown.uuid, 'air')
  publish(rundown.uuid, 'air', { type: 'air', data: upsertById(base, payload) })
  return new Response(null, { status: 200 })
}
