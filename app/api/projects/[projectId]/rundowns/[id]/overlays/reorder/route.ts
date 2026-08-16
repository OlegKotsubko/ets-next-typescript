import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownOverlays } from '@/db/schema'
import { reorderSchema } from '@/db/schemas/rundown-overlays'
import { requireSession } from '@/lib/crud/requireSession'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const parsed = reorderSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const rundownId = Number(id)
  // Sequential (neon-http has no transactions).
  for (let i = 0; i < parsed.data.orderedIds.length; i += 1) {
    await db.update(rundownOverlays).set({ order: i })
      .where(and(eq(rundownOverlays.id, parsed.data.orderedIds[i]), eq(rundownOverlays.rundownId, rundownId)))
  }
  return new Response(null, { status: 204 })
}
