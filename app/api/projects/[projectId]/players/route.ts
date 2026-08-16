import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, playerPhotos } from '@/db/schema'
import { createPlayerSchema } from '@/db/schemas/players'
import { requireSession } from '@/lib/crud/requireSession'

// Players carry a child photos table, so they use bespoke handlers (the generic
// factory only writes the parent row). Child writes are sequential — the
// neon-http driver has no interactive transactions.
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const rows = await db.select().from(players).where(eq(players.projectId, Number(projectId)))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const parsed = createPlayerSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { photos, ...fields } = parsed.data
  const [row] = await db.insert(players).values({ ...fields, projectId: Number(projectId) }).returning()
  if (photos?.length) {
    await db.insert(playerPhotos).values(photos.map((p) => ({ ...p, playerId: row.id })))
  }
  return Response.json(row, { status: 201 })
}
