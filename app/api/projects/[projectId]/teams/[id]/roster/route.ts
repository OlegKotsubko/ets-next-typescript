import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { teamPlayers } from '@/db/schema'
import { replaceRosterSchema } from '@/db/schemas/teams'
import { auth } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { projectId, id: teamId } = await params
  const body = await req.json()
  const parsed = replaceRosterSchema.safeParse(body)
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })

  await db.transaction(async (tx) => {
    await tx.delete(teamPlayers).where(and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.projectId, projectId)))
    for (const slot of parsed.data.slots) {
      await tx.insert(teamPlayers).values({
        projectId,
        teamId,
        playerId: slot.playerId,
        slot: slot.slot,
        isCaptain: slot.isCaptain,
        isStandIn: slot.isStandIn,
      })
    }
  })

  return Response.json({ ok: true })
}
