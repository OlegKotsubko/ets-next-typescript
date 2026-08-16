import { db } from '@/db'
import { tags } from '@/db/schema'
import { createTagSchema } from '@/db/schemas/tags'
import { requireSession } from '@/lib/crud/requireSession'

// Global tags: no project scoping. Session-guarded (any operator may read/manage
// the shared discipline vocabulary).
export async function GET(req: Request) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  return Response.json(await db.select().from(tags))
}

export async function POST(req: Request) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const parsed = createTagSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(tags).values(parsed.data).returning()
  return Response.json(row, { status: 201 })
}
