import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { setSettingsSchema } from '@/db/schemas/displays'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'

async function userId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  return session?.user?.id ?? null
}

export async function GET(req: Request) {
  const uid = await userId(req)
  if (!uid) return new Response('Unauthorized', { status: 401 })
  const [row] = await db.select().from(settings).where(eq(settings.userId, uid))
  return Response.json(row ?? { userId: uid, displayId: null })
}

export async function PUT(req: Request) {
  const uid = await userId(req)
  if (!uid) return new Response('Unauthorized', { status: 401 })
  const parsed = setSettingsSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const [row] = await db.insert(settings)
    .values({ userId: uid, displayId: parsed.data.displayId })
    .onConflictDoUpdate({ target: settings.userId, set: { displayId: parsed.data.displayId, updatedAt: new Date() } })
    .returning()
  return Response.json(row)
}
