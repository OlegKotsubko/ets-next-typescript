import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { publish } from '@/lib/broadcast/bus'
import type { Channel } from '@/lib/broadcast/types'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  const { channel } = await req.json() as { channel: Channel }
  const [display] = await db.select().from(displays).where(eq(displays.id, Number(displayId)))
  if (!display) return Response.json({ error: 'Display not found' }, { status: 404 })
  publish(display.uuid, channel === 'preview' ? 'preview' : 'air', { type: 'hide_all' })
  return new Response(null, { status: 200 })
}
