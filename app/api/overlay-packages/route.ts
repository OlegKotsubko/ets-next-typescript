import { auth } from '@/lib/auth'
import { listOverlayPackages } from '@/lib/projects/packages'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const packages = await listOverlayPackages()
  return Response.json(packages)
}
