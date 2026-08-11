// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const packageExistsMock = vi.fn()
vi.mock('@/lib/projects/packages', () => ({ packageExists: (...args: unknown[]) => packageExistsMock(...args) }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { GET, POST } = await import('@/app/api/projects/route')

function req(body?: unknown, method = 'POST') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}

describe('GET/POST /api/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(req(undefined, 'GET'))
    expect(res.status).toBe(401)
  })

  it('GET returns all rows on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const rows = [{ id: 'p1', name: 'Test Event' }]
    dbMock.select.mockReturnValue({ from: vi.fn().mockResolvedValue(rows) })
    const res = await GET(req(undefined, 'GET'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
  })

  it('POST returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await POST(req({ name: 'x', mode: 'team_vs_team', label: 'default' }))
    expect(res.status).toBe(401)
  })

  it('POST returns 400 on invalid body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({ name: '', mode: 'team_vs_team', label: 'default' }))
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when label does not match a real package', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    packageExistsMock.mockReturnValue(false)
    const res = await POST(req({ name: 'Test Event', mode: 'team_vs_team', label: 'nonexistent' }))
    expect(res.status).toBe(400)
    expect(packageExistsMock).toHaveBeenCalledWith('nonexistent')
  })

  it('POST returns 201 and the inserted row on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    packageExistsMock.mockReturnValue(true)
    const row = { id: 'p1', name: 'Test Event', mode: 'team_vs_team', label: 'default' }
    const returning = vi.fn().mockResolvedValue([row])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await POST(req({ name: 'Test Event', mode: 'team_vs_team', label: 'default' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(row)
  })
})
