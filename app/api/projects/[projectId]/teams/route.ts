import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { teams, teamLogos, teamPlayers } from '@/db/schema'
import { createTeamSchema } from '@/db/schemas/teams'
import { requireSession } from '@/lib/crud/requireSession'

// Teams fan out to two child tables (team_logos, team_players), so they use
// bespoke handlers. Child writes are sequential (no neon-http transactions).
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const rows = await db.select().from(teams).where(eq(teams.projectId, Number(projectId)))
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireSession(req)
  if (unauthorized) return unauthorized
  const { projectId } = await params
  const parsed = createTeamSchema.safeParse(await req.json())
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
  const { logos, roster, ...fields } = parsed.data
  const [row] = await db.insert(teams).values({ ...fields, projectId: Number(projectId) }).returning()
  if (logos?.length) {
    await db.insert(teamLogos).values(logos.map((l) => ({ ...l, teamId: row.id })))
  }
  if (roster?.length) {
    await db.insert(teamPlayers).values(roster.map((r) => ({ ...r, teamId: row.id })))
  }
  return Response.json(row, { status: 201 })
}
