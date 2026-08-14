import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownItems } from '@/db/schema'
import { reorderRundownItemsSchema } from '@/db/schemas/rundown-items'
import { loadItemsContext } from '@/lib/rundown-items/context'

// The rundown segment is `[id]` (matches the sibling rundown CRUD route);
// aliased to `rundownId` locally.
type Ctx = { params: Promise<{ projectId: string; id: string }> }

export async function PUT(req: Request, { params }: Ctx) {
  const { projectId, id: rundownId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx

  const parsed = reorderRundownItemsSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { orderedIds } = parsed.data

  const current = await db.select({ id: rundownItems.id }).from(rundownItems)
    .where(and(eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .orderBy(rundownItems.position)
  const currentSet = new Set(current.map((r) => r.id))
  const sameSet = orderedIds.length === currentSet.size && orderedIds.every((id) => currentSet.has(id))
  if (!sameSet) return Response.json({ error: 'orderedIds must be the rundown\'s exact item set' }, { status: 400 })

  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(rundownItems).set({ position: i })
      .where(and(eq(rundownItems.id, orderedIds[i]), eq(rundownItems.rundownId, rundownId)))
  }
  const rows = await db.select().from(rundownItems)
    .where(and(eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .orderBy(rundownItems.position)
  return Response.json(rows)
}
