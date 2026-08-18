import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { publish } from '@/lib/broadcast/bus'
import type { Channel } from '@/lib/broadcast/types'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const { overlayId, channel } = await req.json() as { overlayId: number; channel: Channel }
  const [rundown] = await db.select().from(rundowns).where(eq(rundowns.id, Number(id)))
  if (!rundown) return Response.json({ error: 'Rundown not found' }, { status: 404 })
  publish(rundown.uuid, channel === 'preview' ? 'preview' : 'air', { type: 'hide', data: { id: Number(overlayId) } })
  return new Response(null, { status: 200 })
}
