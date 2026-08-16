// Storage abstraction — de-Netlified upload target. The default dev/prod
// implementation writes under public/media; swap this module's body for an
// S3/R2 client in a real deploy (see docs/deployment.md §6). The DB stores
// only the returned URL.
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export type StoredObject = { url: string; sizeBytes: number }

export async function putObject(key: string, bytes: ArrayBuffer, _mimeType: string): Promise<StoredObject> {
  const rel = join('media', key)
  const abs = join(process.cwd(), 'public', rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, Buffer.from(bytes))
  return { url: `/${rel}`, sizeBytes: bytes.byteLength }
}
