import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { matches, seatings } from '@/db/schema'
import { upsertSeatingSchema } from '@/db/schemas/brackets'
import { requireSession } from '@/lib/crud/requireSession'

// One seating per match (PK = matchId). Activating a seating deactivates the
// other seatings in the same project (join through matches) — drives ATEM.
async function ownedMatch(projectId: number, matchId: number) {
  const [m] = await db.select().from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.projectId, projectId)))
  return m
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  if (!(await ownedMatch(Number(projectId), Number(id)))) return new Response('Not found', { status: 404 })
  const [seating] = await db.select().from(seatings).where(eq(seatings.matchId, Number(id)))
  return Response.json(seating ?? null)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const pid = Number(projectId)
  const matchId = Number(id)
  const parsed = upsertSeatingSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  if (!(await ownedMatch(pid, matchId))) return new Response('Not found', { status: 404 })

  if (parsed.data.isActive) {
    const projMatches = await db.select({ id: matches.id }).from(matches).where(eq(matches.projectId, pid))
    const otherIds = projMatches.map((m) => m.id).filter((mid) => mid !== matchId)
    if (otherIds.length) {
      await db.update(seatings).set({ isActive: false }).where(inArray(seatings.matchId, otherIds))
    }
  }

  const [row] = await db.insert(seatings)
    .values({ ...parsed.data, matchId })
    .onConflictDoUpdate({ target: seatings.matchId, set: parsed.data })
    .returning()
  return Response.json(row)
}
