// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const list = await import('@/app/api/projects/route')
const one = await import('@/app/api/projects/[projectId]/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown, method = 'POST') => new Request('http://x', { method, body: JSON.stringify(o) })

describe('project CRUD', () => {
  beforeEach(() => { vi.clearAllMocks(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('POST creates a tournament', async () => {
    const row = { id: 1, title: 'T', status: 'draft', overlayPacks: ['MRI'] }
    dbMock.insert.mockReturnValue({ values: () => ({ returning: () => Promise.resolve([row]) }) })
    const res = await list.POST(body({ title: 'T', overlayPacks: ['MRI'] }))
    expect(res.status).toBe(201)
    expect((await res.json()).overlayPacks).toEqual(['MRI'])
  })
  it('POST rejects an empty title', async () => {
    const res = await list.POST(body({ title: '' }))
    expect(res.status).toBe(400)
  })
  it('PATCH updates', async () => {
    const row = { id: 1, title: 'X', status: 'draft', overlayPacks: [] }
    dbMock.update.mockReturnValue({ set: () => ({ where: () => ({ returning: () => Promise.resolve([row]) }) }) })
    const res = await one.PATCH(body({ title: 'X' }, 'PATCH'), P({ projectId: '1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).title).toBe('X')
  })
  it('PATCH 404 when the row is missing', async () => {
    dbMock.update.mockReturnValue({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) })
    const res = await one.PATCH(body({ title: 'X' }, 'PATCH'), P({ projectId: '9' }))
    expect(res.status).toBe(404)
  })
  it('DELETE removes', async () => {
    dbMock.delete.mockReturnValue({ where: () => Promise.resolve() })
    const res = await one.DELETE(new Request('http://x', { method: 'DELETE' }), P({ projectId: '1' }))
    expect(res.status).toBe(200)
  })
  it('POST 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await list.POST(body({ title: 'T' }))
    expect(res.status).toBe(401)
  })
})
