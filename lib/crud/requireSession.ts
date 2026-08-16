import { auth } from '@/lib/auth'

// Returns a 401 Response when there is no session, otherwise null. Shared by the
// generic CRUD factory and the bespoke composite routes (players/teams).
export async function requireSession(req: Request): Promise<Response | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  return null
}
