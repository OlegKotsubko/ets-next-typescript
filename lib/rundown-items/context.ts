import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { auth } from '@/lib/auth'
import { rundowns, projects } from '@/db/schema'

// Verifies the session and that the rundown exists and belongs to projectId,
// then returns the project's overlay-package label (needed to resolve the
// title's model.ts). Returns a Response (401/404) on failure so callers can
// early-return it.
export async function loadItemsContext(
  req: Request, projectId: string, rundownId: string,
): Promise<Response | { packageLabel: string }> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const [row] = await db
    .select({ packageLabel: projects.label })
    .from(rundowns)
    .innerJoin(projects, eq(rundowns.projectId, projects.id))
    .where(and(eq(rundowns.id, rundownId), eq(rundowns.projectId, projectId)))
  if (!row) return new Response('Not found', { status: 404 })
  return { packageLabel: row.packageLabel }
}
