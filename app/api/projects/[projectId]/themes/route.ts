import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { themes } from '@/db/schema'
import { createThemeSchema } from '@/db/schemas/themes'
import { requireSession } from '@/lib/crud/requireSession'

// Exactly one theme per tournament is active; activating one deactivates the rest.
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  return Response.json(await db.select().from(themes).where(eq(themes.projectId, Number(projectId))))
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const parsed = createThemeSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const pid = Number(projectId)
  if (parsed.data.isActive) {
    await db.update(themes).set({ isActive: false }).where(eq(themes.projectId, pid))
  }
  const [row] = await db.insert(themes).values({ ...parsed.data, projectId: pid }).returning()
  return Response.json(row, { status: 201 })
}
