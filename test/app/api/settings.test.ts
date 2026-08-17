// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/settings/route')
const put = (o: unknown) => new Request('http://localhost/api/settings', { method: 'PUT', body: JSON.stringify(o) })

describe('settings routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await route.GET(new Request('http://localhost/api/settings'))).status).toBe(401)
  })
  it('PUT upserts the active display for the session user', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ userId: 'u1', displayId: 7 }]) })
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    dbMock.insert.mockReturnValue({ values })
    const res = await route.PUT(put({ displayId: 7 }))
    expect(res.status).toBe(200)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', displayId: 7 }))
  })
})
