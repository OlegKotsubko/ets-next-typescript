import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownOverlays } from '@/db/schema'
import { updateRundownOverlaySchema } from '@/db/schemas/rundown-overlays'
import { getOverlayModel } from '@/lib/overlays/catalog'
import { requireSession } from '@/lib/crud/requireSession'

type Params = { params: Promise<{ projectId: string; id: string; overlayId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, overlayId } = await params
  const parsed = updateRundownOverlaySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { widget, ...fields } = parsed.data
  const filter = and(eq(rundownOverlays.id, Number(overlayId)), eq(rundownOverlays.projectId, Number(projectId)))

  const set: Record<string, unknown> = { ...fields, updatedAt: new Date() }
  if (widget !== undefined) {
    const [existing] = await db.select({ model: rundownOverlays.model }).from(rundownOverlays).where(filter)
    if (!existing) return new Response('Not found', { status: 404 })
    const schema = getOverlayModel(existing.model)
    if (!schema) return Response.json({ error: `Unknown overlay model "${existing.model}"` }, { status: 400 })
    const w = schema.safeParse(widget)
    if (!w.success) return Response.json(w.error.flatten(), { status: 400 })
    set.data = { widget: w.data }
  }

  const [row] = await db.update(rundownOverlays).set(set).where(filter).returning()
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export async function DELETE(req: Request, { params }: Params) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, overlayId } = await params
  const [row] = await db.delete(rundownOverlays)
    .where(and(eq(rundownOverlays.id, Number(overlayId)), eq(rundownOverlays.projectId, Number(projectId))))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
