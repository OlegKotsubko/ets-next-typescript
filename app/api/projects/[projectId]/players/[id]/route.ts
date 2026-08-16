import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, playerPhotos } from '@/db/schema'
import { updatePlayerSchema } from '@/db/schemas/players'
import { requireSession } from '@/lib/crud/requireSession'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const parsed = updatePlayerSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { photos, ...fields } = parsed.data
  const [row] = await db.update(players)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(players.id, Number(id)), eq(players.projectId, Number(projectId))))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  // Replace photos only when the client sent the field (untouched → left intact).
  if (photos !== undefined) {
    await db.delete(playerPhotos).where(eq(playerPhotos.playerId, row.id))
    if (photos.length) {
      await db.insert(playerPhotos).values(photos.map((p) => ({ ...p, playerId: row.id })))
    }
  }
  return Response.json(row)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const [row] = await db.delete(players)
    .where(and(eq(players.id, Number(id)), eq(players.projectId, Number(projectId))))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
