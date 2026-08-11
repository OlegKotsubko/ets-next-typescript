import { db } from '@/db'
import { projects, createProjectSchema } from '@/db/schema'
import { auth } from '@/lib/auth'
import { packageExists } from '@/lib/projects/packages'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const rows = await db.select().from(projects)
  return Response.json(rows)
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  if (!packageExists(parsed.data.label)) {
    return Response.json({ error: `No overlay package found for label "${parsed.data.label}"` }, { status: 400 })
  }

  const [row] = await db.insert(projects).values(parsed.data).returning()
  return Response.json(row, { status: 201 })
}
