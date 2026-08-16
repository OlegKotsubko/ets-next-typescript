import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns } from '@/db/schema'
import { auth } from '@/lib/auth'
import { createRundownSchema, updateRundownSchema } from '@/db/schemas/rundowns'
import { createCrudHandlers } from '@/lib/crud/createCrudHandlers'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId, id } = await params
  const [row] = await db.select().from(rundowns)
    .where(and(eq(rundowns.id, Number(id)), eq(rundowns.projectId, Number(projectId))))
  if (!row) return new Response('Not found', { status: 404 })
  return Response.json(row)
}

export const { PATCH, DELETE } = createCrudHandlers({
  table: rundowns,
  createSchema: createRundownSchema,
  updateSchema: updateRundownSchema,
})
