import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { rundownItems } from '@/db/schema'
import { createRundownItemSchema } from '@/db/schemas/rundown-items'
import { getTitleModel } from '@/lib/titles/registry'
import { loadItemsContext } from '@/lib/rundown-items/context'

type Ctx = { params: Promise<{ projectId: string; rundownId: string }> }

export async function GET(req: Request, { params }: Ctx) {
  const { projectId, rundownId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx
  const rows = await db.select().from(rundownItems)
    .where(and(eq(rundownItems.rundownId, rundownId), eq(rundownItems.projectId, projectId)))
    .orderBy(rundownItems.position)
  return Response.json(rows)
}

export async function POST(req: Request, { params }: Ctx) {
  const { projectId, rundownId } = await params
  const ctx = await loadItemsContext(req, projectId, rundownId)
  if (ctx instanceof Response) return ctx

  const parsed = createRundownItemSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const model = getTitleModel(ctx.packageLabel, parsed.data.titleKey)
  if (!model) return Response.json({ error: 'unknown titleKey' }, { status: 400 })

  const dataParsed = model.safeParse(parsed.data.data)
  if (!dataParsed.success) return Response.json(dataParsed.error.flatten(), { status: 400 })

  const [last] = await db.select({ position: rundownItems.position }).from(rundownItems)
    .where(eq(rundownItems.rundownId, rundownId))
    .orderBy(desc(rundownItems.position)).limit(1)
  const position = last ? last.position + 1 : 0

  const [row] = await db.insert(rundownItems).values({
    rundownId, projectId, titleKey: parsed.data.titleKey,
    label: parsed.data.label ?? null, position, data: dataParsed.data as Record<string, unknown>,
  }).returning()
  return Response.json(row, { status: 201 })
}
