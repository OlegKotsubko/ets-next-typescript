// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/projects/route')

// A thenable query builder that resolves to `rows` whether or not .where() is chained.
function thenable(rows: unknown[]) {
  const b: any = {
    from: () => b,
    where: () => b,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej),
  }
  return b
}
function get(url = 'http://localhost/api/projects') {
  return new Request(url)
}

describe('GET /api/projects (tournaments)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    expect((await route.GET(get())).status).toBe(401)
  })

  it('marks the operator favourites', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select
      .mockReturnValueOnce(thenable([
        { id: 1, title: 'Major', status: 'ongoing' },
        { id: 2, title: 'Minor', status: 'draft' },
      ]))
      .mockReturnValueOnce(thenable([{ projectId: 1, userId: 'u1' }]))
    const res = await route.GET(get())
    expect(await res.json()).toEqual([
      { id: 1, title: 'Major', status: 'ongoing', isFavourite: true },
      { id: 2, title: 'Minor', status: 'draft', isFavourite: false },
    ])
  })

  it('rejects an invalid status filter with 400', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await route.GET(get('http://localhost/api/projects?status=bogus'))
    expect(res.status).toBe(400)
  })

  it('exposes POST — tournaments are created in-app', () => {
    expect(typeof (route as Record<string, unknown>).POST).toBe('function')
  })
})
