import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { brackets } from '@/db/schema'
import { updateMatchSchema, type BracketRound } from '@/db/schemas/brackets'
import { auth } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string; matchId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId, id, matchId } = await params
  const body = await req.json()
  const parsed = updateMatchSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  const [bracket] = await db.select().from(brackets)
    .where(and(eq(brackets.id, id), eq(brackets.projectId, projectId)))
  if (!bracket) return new Response('Not found', { status: 404 })

  const rounds = bracket.rounds as BracketRound[]
  let found = false
  const nextRounds = rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => {
      if (match.id !== matchId) return match
      found = true
      return { ...match, ...parsed.data }
    }),
  }))
  if (!found) return new Response('Match not found', { status: 404 })

  const [row] = await db.update(brackets)
    .set({ rounds: nextRounds, updatedAt: new Date() })
    .where(and(eq(brackets.id, id), eq(brackets.projectId, projectId)))
    .returning()
  return Response.json(row)
}
