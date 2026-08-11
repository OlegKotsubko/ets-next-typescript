import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { brackets } from '@/db/schema'
import { createBracketSchema } from '@/db/schemas/brackets'
import { auth } from '@/lib/auth'
import { generateSingleElim } from '@/lib/brackets/generate'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const rows = await db.select().from(brackets).where(eq(brackets.projectId, projectId))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const body = await req.json()
  const parsed = createBracketSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const rounds = generateSingleElim(parsed.data.participantCount)
  const [row] = await db.insert(brackets).values({
    projectId,
    name: parsed.data.name,
    format: 'single-elim',
    participantCount: parsed.data.participantCount,
    rounds,
  }).returning()
  return Response.json(row, { status: 201 })
}
