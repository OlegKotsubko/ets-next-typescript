import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects, projectFavourites } from '@/db/schema'
import { auth } from '@/lib/auth'
import { projectStatus, createProjectSchema } from '@/db/schemas/projects'

// GET lists tournaments (optional ?status= filter) and marks the operator's
// favourites; POST creates one (tournaments are authored in-app).
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

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const parsed = createProjectSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(projects).values(parsed.data).returning()
  return Response.json(row, { status: 201 })
}
