import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundownOverlays } from '@/db/schema'
import { createRundownOverlaySchema } from '@/db/schemas/rundown-overlays'
import { getCatalogEntry, getOverlayModel } from '@/lib/overlays/catalog'
import { requireSession } from '@/lib/crud/requireSession'

// [id] = rundownId. Overlay config is derived from the registry (category/
// template/preview/default widget); the body only carries operator choices.
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const rows = await db.select().from(rundownOverlays)
    .where(eq(rundownOverlays.rundownId, Number(id)))
    .orderBy(asc(rundownOverlays.order))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const parsed = createRundownOverlaySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const entry = getCatalogEntry(parsed.data.model)
  if (!entry) return Response.json({ error: `Unknown overlay model "${parsed.data.model}"` }, { status: 400 })

  const rundownId = Number(id)
  const existing = await db.select({ id: rundownOverlays.id }).from(rundownOverlays)
    .where(eq(rundownOverlays.rundownId, rundownId))
  const widget = getOverlayModel(entry.model)!.parse({}) as Record<string, unknown>

  const [row] = await db.insert(rundownOverlays).values({
    rundownId,
    projectId: Number(projectId),
    model: entry.model,
    category: entry.category,
    template: entry.template,
    widgetName: parsed.data.widgetName ?? entry.widgetName,
    previewImg: entry.preview?.default ?? null,
    isFullscreen: parsed.data.isFullscreen ?? entry.isFullscreen,
    layer: parsed.data.layer,
    color: parsed.data.color,
    displayFilter: parsed.data.displayFilter ?? null,
    order: existing.length,
    data: { widget },
  }).returning()
  return Response.json(row, { status: 201 })
}
