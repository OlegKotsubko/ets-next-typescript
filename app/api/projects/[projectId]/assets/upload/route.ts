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
  if (!(file instanceof File)) {
    return Response.json({ error: 'file is required' }, { status: 400 })
  }
  const assetType = formData.get('assetType') === 'background' ? 'background' : 'decor'

  const { url, sizeBytes } = await uploadAsset(projectId, file)
  const [row] = await db.insert(assets).values({
    projectId: Number(projectId),
    name: file.name,
    url,
    mimeType: file.type,
    sizeBytes,
    assetType,
  }).returning()
  return Response.json(row, { status: 201 })
}
