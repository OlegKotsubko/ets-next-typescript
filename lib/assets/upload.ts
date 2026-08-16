import { putObject } from '@/lib/storage'

export async function uploadAsset(projectId: string, file: File) {
  const key = `${projectId}/${crypto.randomUUID()}-${file.name}`
  return putObject(key, await file.arrayBuffer(), file.type)
}
