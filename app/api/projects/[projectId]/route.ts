import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects } from '@/db/schema'
import { auth } from '@/lib/auth'
import { updateProjectSchema } from '@/db/schemas/projects'

// Single tournament row (used by the rundown editor to resolve overlay packs).
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const [row] = await db.select().from(projects).where(eq(projects.id, Number(projectId)))
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const parsed = updateProjectSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.update(projects).set(parsed.data)
    .where(eq(projects.id, Number(projectId))).returning()
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  await db.delete(projects).where(eq(projects.id, Number(projectId)))
  return new Response(null, { status: 200 })
}
