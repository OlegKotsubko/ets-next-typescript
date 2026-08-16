import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { themes } from '@/db/schema'
import { updateThemeSchema } from '@/db/schemas/themes'
import { requireSession } from '@/lib/crud/requireSession'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const parsed = updateThemeSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const pid = Number(projectId)
  if (parsed.data.isActive === true) {
    await db.update(themes).set({ isActive: false })
      .where(and(eq(themes.projectId, pid), ne(themes.id, Number(id))))
  }
  const [row] = await db.update(themes).set(parsed.data)
    .where(and(eq(themes.id, Number(id)), eq(themes.projectId, pid)))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const [row] = await db.delete(themes)
    .where(and(eq(themes.id, Number(id)), eq(themes.projectId, Number(projectId))))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
