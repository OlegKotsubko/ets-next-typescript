import { auth } from '@/lib/auth'
import { getProjectLabel } from '@/lib/projects/getProjectLabel'
import { listTitleOptions } from '@/lib/titles/listTitleOptions'

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  const { projectId } = await params
  const label = await getProjectLabel(projectId)
  if (!label) return new Response('Not found', { status: 404 })
  return Response.json(listTitleOptions(label))
}
