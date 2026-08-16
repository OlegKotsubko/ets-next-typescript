// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/projects/[projectId]/rundowns/route')

function json(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })

describe('rundowns route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST returns 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await route.POST(json({ name: 'Show' }), params({ projectId: '1' }))).status).toBe(401)
  })

  it('POST inserts with integer projectId and the session user as owner', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-42' } })
    const returning = vi.fn().mockResolvedValue([{ id: 1, name: 'Show' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await route.POST(json({ name: 'Show' }), params({ projectId: '8' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ name: 'Show', projectId: 8, userId: 'user-42' }))
  })

  it('POST returns 400 on an empty name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-42' } })
    expect((await route.POST(json({ name: '' }), params({ projectId: '8' }))).status).toBe(400)
  })
})
