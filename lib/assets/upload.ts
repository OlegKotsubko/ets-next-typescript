import { getStore } from '@netlify/blobs'

export async function uploadAsset(projectId: string, file: File, kind: string) {
  const store = getStore('assets')
  const key = `${projectId}/${crypto.randomUUID()}-${file.name}`
  const bytes = await file.arrayBuffer()
  await store.set(key, bytes, { metadata: { mimeType: file.type, kind } })
  return {
    url: `/.netlify/blobs/assets/${key}`,
    sizeBytes: bytes.byteLength,
  }
}
