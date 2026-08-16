import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { teams, teamLogos, teamPlayers } from '@/db/schema'
import { updateTeamSchema } from '@/db/schemas/teams'
import { requireSession } from '@/lib/crud/requireSession'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const parsed = updateTeamSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { logos, roster, ...fields } = parsed.data
  const [row] = await db.update(teams)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(teams.id, Number(id)), eq(teams.projectId, Number(projectId))))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  if (logos !== undefined) {
    await db.delete(teamLogos).where(eq(teamLogos.teamId, row.id))
    if (logos.length) await db.insert(teamLogos).values(logos.map((l) => ({ ...l, teamId: row.id })))
  }
  if (roster !== undefined) {
    await db.delete(teamPlayers).where(eq(teamPlayers.teamId, row.id))
    if (roster.length) await db.insert(teamPlayers).values(roster.map((r) => ({ ...r, teamId: row.id })))
  }
  return Response.json(row)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId, id } = await params
  const [row] = await db.delete(teams)
    .where(and(eq(teams.id, Number(id)), eq(teams.projectId, Number(projectId))))
    .returning()
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(null, { status: 204 })
}
