import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'

export const runtime = 'nodejs'

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string; displayId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { displayId } = await params
  await db.delete(displays).where(eq(displays.id, Number(displayId)))
  return new Response(null, { status: 204 })
}
