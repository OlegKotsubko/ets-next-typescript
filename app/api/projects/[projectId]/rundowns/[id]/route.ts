import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { projectId, id } = await params
  const [row] = await db.select().from(rundowns).where(and(eq(rundowns.id, id), eq(rundowns.projectId, projectId)))
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}
