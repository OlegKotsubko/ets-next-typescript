// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const uploadAssetMock = vi.fn()
vi.mock('@/lib/assets/upload', () => ({ uploadAsset: (...a: unknown[]) => uploadAssetMock(...a) }))

const assets = await import('@/app/api/projects/[projectId]/assets/route')
const upload = await import('@/app/api/projects/[projectId]/assets/upload/route')
const videos = await import('@/app/api/projects/[projectId]/videos/route')

function json(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve(o) })

describe('assets + videos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assets POST inserts with the URL projectId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 1, name: 'bg' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await assets.POST(json({ name: 'bg', url: 'https://x/b.png', assetType: 'background' }), params({ projectId: '4' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'bg', projectId: 4, assetType: 'background' }))
  })

  it('upload stores the file and inserts an asset row', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    uploadAssetMock.mockResolvedValue({ url: '/media/4/x-a.png', sizeBytes: 3 })
    const returning = vi.fn().mockResolvedValue([{ id: 2, name: 'a.png', url: '/media/4/x-a.png' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })

    const fd = new FormData()
    fd.append('file', new File(['abc'], 'a.png', { type: 'image/png' }))
    const res = await upload.POST(new Request('http://localhost/u', { method: 'POST', body: fd }), params({ projectId: '4' }))

    expect(res.status).toBe(201)
    expect(uploadAssetMock).toHaveBeenCalledOnce()
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 4, name: 'a.png', url: '/media/4/x-a.png', sizeBytes: 3, mimeType: 'image/png',
    }))
  })

  it('upload returns 400 without a file', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await upload.POST(new Request('http://localhost/u', { method: 'POST', body: new FormData() }), params({ projectId: '4' }))
    expect(res.status).toBe(400)
  })

  it('videos POST rejects a non-URL', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await videos.POST(json({ name: 'v', url: 'not-a-url' }), params({ projectId: '4' }))
    expect(res.status).toBe(400)
  })
})
