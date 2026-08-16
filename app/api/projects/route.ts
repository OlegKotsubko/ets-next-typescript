import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects, projectFavourites } from '@/db/schema'
import { auth } from '@/lib/auth'
import { projectStatus } from '@/db/schemas/projects'

// Tournaments are absorbed, not created in-app — there is no POST. GET lists
// them (optional ?status= filter) and marks the operator's favourites.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const statusParam = new URL(req.url).searchParams.get('status')
  const parsedStatus = statusParam ? projectStatus.safeParse(statusParam) : null
  if (parsedStatus && !parsedStatus.success) {
    return Response.json({ error: 'invalid status' }, { status: 400 })
  }

  const q = db.select().from(projects)
  const rows = parsedStatus?.success
    ? await q.where(eq(projects.status, parsedStatus.data))
    : await q

  const favs = await db.select().from(projectFavourites)
    .where(eq(projectFavourites.userId, session.user.id))
  const favSet = new Set(favs.map((f) => f.projectId))

  return Response.json(rows.map((p) => ({ ...p, isFavourite: favSet.has(p.id) })))
}
