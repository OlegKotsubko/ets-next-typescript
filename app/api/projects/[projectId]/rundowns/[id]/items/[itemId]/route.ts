import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownItems } from '@/db/schema'
import { updateRundownItemSchema } from '@/db/schemas/rundown-items'
import { getTitleModel } from '@/lib/titles/registry'
import { loadItemsContext } from '@/lib/rundown-items/context'

// The rundown segment is `[id]` (matches the sibling rundown CRUD route);
// aliased to `rundownId` locally.
type Ctx = { params: Promise<{ projectId: string; id: string; itemId: string }> }

async function loadItem(projectId: string, rundownId: string, itemId: string) {
  const [row] = await db.select().from(rundownItems)
    .where(and(eq(rundownItems.id, itemId), eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .limit(1)
  return row
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { projectId, id: rundownId, itemId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx

  const parsed = updateRundownItemSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const item = await loadItem(projectId, rundownId, itemId)
  if (!item) return new Response('Not found', { status: 404 })

  const patch: Record<string, unknown> = {}
  if (parsed.data.label !== undefined) patch.label = parsed.data.label
  if (parsed.data.data !== undefined) {
    const model = getTitleModel(ctx.packageLabel, item.titleKey)
    if (!model) return Response.json({ error: 'unknown titleKey' }, { status: 400 })
    const dataParsed = model.safeParse(parsed.data.data)
    if (!dataParsed.success) return Response.json(dataParsed.error.flatten(), { status: 400 })
    patch.data = dataParsed.data
  }

  const [row] = await db.update(rundownItems).set(patch)
    .where(and(eq(rundownItems.id, itemId), eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .returning()
  return Response.json(row)
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { projectId, id: rundownId, itemId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx
  const [row] = await db.delete(rundownItems)
    .where(and(eq(rundownItems.id, itemId), eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
