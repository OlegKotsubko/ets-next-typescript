import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns, rundownOverlays } from '@/db/schema'
import { requireSession } from '@/lib/crud/requireSession'
import { getSnapshot, publish } from '@/lib/broadcast/bus'
import { upsertById } from '@/lib/broadcast/liveReducer'
import { toOverlayPayload } from '@/lib/broadcast/payload'
import { getOverlayModel } from '@/lib/overlays/catalog'

export const runtime = 'nodejs'

// Stage an overlay to the rundown's preview channel. The controller card sends
// the operator's currently-edited `widget` values (etalon: showPreview); when
// omitted we fall back to the authored row. Values are validated against the
// overlay model — invalid fields come back as field_mapping[] for the form.
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const { overlayId, widget } = await req.json() as { overlayId: number; widget?: Record<string, unknown> }

  const [rundown] = await db.select().from(rundowns).where(eq(rundowns.id, Number(id)))
  if (!rundown) return Response.json({ error: 'Rundown not found' }, { status: 404 })
  const [overlay] = await db.select().from(rundownOverlays).where(eq(rundownOverlays.id, Number(overlayId)))
  if (!overlay) return Response.json({ error: 'Overlay not found' }, { status: 404 })

  const payload = toOverlayPayload(overlay)
  if (widget) {
    let next = widget
    const schema = getOverlayModel(overlay.model)
    if (schema) {
      const parsed = schema.safeParse(widget)
      if (!parsed.success) {
        const field_mapping = parsed.error.issues.map((i) => ({
          field: String(i.path[0] ?? ''),
          message: i.message,
        }))
        return Response.json({ error: { field_mapping } }, { status: 400 })
      }
      next = parsed.data as Record<string, unknown>
    }
    payload.data = { widget: next }
    // Persist the edited values so a later hide → re-stage re-reads them
    // (edits must survive, not just live on the transient bus).
    await db.update(rundownOverlays)
      .set({ data: { widget: next }, updatedAt: new Date() })
      .where(eq(rundownOverlays.id, overlay.id))
  }

  const set = upsertById(getSnapshot(rundown.uuid, 'preview'), payload)
  publish(rundown.uuid, 'preview', { type: 'preview', data: set })
  return new Response(null, { status: 200 })
}
