// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn(), insert: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const list = await import('@/app/api/projects/[projectId]/displays/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

describe('displays routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST 400 on empty name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await list.POST(body({ name: '' }), P({ projectId: '3' }))
    expect(res.status).toBe(400)
  })
  it('POST inserts under the URL projectId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1, uuid: 'x', name: 'Main', projectId: 3 }]) })
    dbMock.insert.mockReturnValue({ values })
    const res = await list.POST(body({ name: 'Main' }), P({ projectId: '3' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'Main', projectId: 3 }))
  })
  it('GET 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await list.GET(new Request('http://localhost/x'), P({ projectId: '3' }))
    expect(res.status).toBe(401)
  })
})
