import { db } from '@/db'
import { assets } from '@/db/schema'
import { auth } from '@/lib/auth'
import { uploadAsset } from '@/lib/assets/upload'

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { projectId } = await params
  const formData = await req.formData()
  const file = formData.get('file')
  const kind = formData.get('kind')
  if (!(file instanceof File) || typeof kind !== 'string') {
    return Response.json({ error: 'file and kind are required' }, { status: 400 })
  }

  const { url, sizeBytes } = await uploadAsset(projectId, file, kind)
  const [row] = await db.insert(assets).values({
    projectId,
    filename: file.name,
    mimeType: file.type,
    sizeBytes,
    url,
    kind,
  }).returning()
  return Response.json(row, { status: 201 })
}
