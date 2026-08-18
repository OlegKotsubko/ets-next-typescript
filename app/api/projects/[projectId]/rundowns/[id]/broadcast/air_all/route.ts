import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { getSnapshot, publish } from '@/lib/broadcast/bus'

export const runtime = 'nodejs'

// Take the whole staged preview set to air at once (etalon: the AIR button).
// Air becomes exactly the current preview composition, replacing whatever was
// on air — which is the full-screen-clears-air rule applied to the whole set.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params

  const [rundown] = await db.select().from(rundowns).where(eq(rundowns.id, Number(id)))
  if (!rundown) return Response.json({ error: 'Rundown not found' }, { status: 404 })

  const staged = getSnapshot(rundown.uuid, 'preview')
  publish(rundown.uuid, 'air', { type: 'air', data: staged })
  return new Response(null, { status: 200 })
}
