import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns } from '@/db/schema'
import { auth } from '@/lib/auth'
import { createRundownSchema } from '@/db/schemas/rundowns'

// Bespoke POST so the rundown records its owner (userId) from the session.
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const rows = await db.select().from(rundowns).where(eq(rundowns.projectId, Number(projectId)))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const parsed = createRundownSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(rundowns)
    .values({ ...parsed.data, projectId: Number(projectId), userId: session.user.id })
    .returning()
  return Response.json(row, { status: 201 })
}
