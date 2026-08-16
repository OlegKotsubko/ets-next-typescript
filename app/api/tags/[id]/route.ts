import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tags } from '@/db/schema'
import { updateTagSchema } from '@/db/schemas/tags'
import { requireSession } from '@/lib/crud/requireSession'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const parsed = updateTagSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.update(tags).set(parsed.data).where(eq(tags.id, Number(id))).returning()
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { id } = await params
  const [row] = await db.delete(tags).where(eq(tags.id, Number(id))).returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
