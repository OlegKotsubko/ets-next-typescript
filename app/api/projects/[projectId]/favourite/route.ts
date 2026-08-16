import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { projectFavourites } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  await db.insert(projectFavourites)
    .values({ projectId: Number(projectId), userId: session.user.id })
    .onConflictDoNothing()
  return new Response(null, { status: 204 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  await db.delete(projectFavourites).where(and(
    eq(projectFavourites.projectId, Number(projectId)),
    eq(projectFavourites.userId, session.user.id),
  ))
  return new Response(null, { status: 204 })
}
