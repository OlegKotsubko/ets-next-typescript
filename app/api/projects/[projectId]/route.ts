import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects } from '@/db/schema'
import { auth } from '@/lib/auth'

// Single tournament row (used by the rundown editor to resolve the discipline).
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const [row] = await db.select().from(projects).where(eq(projects.id, Number(projectId)))
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}
