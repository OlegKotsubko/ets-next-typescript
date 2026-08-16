// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/tags/route')

function req(body?: unknown) {
  return new Request('http://localhost/api/tags', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET/POST /api/tags (global vocabulary)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 401 without a session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await route.GET(req())
    expect(res.status).toBe(401)
  })

  it('GET returns all tags with no project filter', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const from = vi.fn().mockResolvedValue([{ id: 1, name: 'Dota 2' }])
    dbMock.select.mockReturnValue({ from })
    const res = await route.GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, name: 'Dota 2' }])
    expect(from).toHaveBeenCalledOnce()
  })

  it('POST returns 400 when name is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await route.POST(req({}))
    expect(res.status).toBe(400)
  })

  it('POST inserts a tag and returns 201', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 5, name: 'CS2' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await route.POST(req({ name: 'CS2' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith({ name: 'CS2' })
  })
})
