import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { displays } from '@/db/schema'
import { createDisplaySchema } from '@/db/schemas/displays'
import { requireSession } from '@/lib/crud/requireSession'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const rows = await db.select().from(displays).where(eq(displays.projectId, Number(projectId)))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const parsed = createDisplaySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(displays).values({ name: parsed.data.name, projectId: Number(projectId) }).returning()
  return Response.json(row, { status: 201 })
}
