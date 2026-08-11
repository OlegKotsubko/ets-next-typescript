import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projectCss } from '@/db/schema'
import { updateProjectCssSchema } from '@/db/schemas/project-css'
import { auth } from '@/lib/auth'
import { validateNoRemoteImport } from '@/lib/css/validate-no-remote-import'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const [row] = await db.select().from(projectCss).where(eq(projectCss.projectId, projectId))
  return Response.json(row ?? { projectId, css: '' })
}

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const body = await req.json()
  const parsed = updateProjectCssSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  if (!validateNoRemoteImport(parsed.data.css)) {
    return Response.json({ error: 'CSS may not @import a remote stylesheet' }, { status: 400 })
  }

  const [row] = await db.insert(projectCss)
    .values({ projectId, css: parsed.data.css })
    .onConflictDoUpdate({ target: projectCss.projectId, set: { css: parsed.data.css, updatedAt: new Date() } })
    .returning()
  return Response.json(row)
}
