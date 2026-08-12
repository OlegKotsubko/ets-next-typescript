// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { GET } = await import('@/app/api/projects/[projectId]/rundowns/[id]/route')

const PROJECT_A = '11111111-1111-1111-1111-111111111111'
const ROW_ID = '22222222-2222-2222-2222-222222222222'

function req() {
  return new Request('http://localhost/x', { method: 'GET' })
}

function ctx(projectId = PROJECT_A, id = ROW_ID) {
  return { params: Promise.resolve({ projectId, id }) }
}

describe('GET /api/projects/[projectId]/rundowns/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(req(), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 404 when no row matches', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) })
    const res = await GET(req(), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 200 and the row when found', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const row = { id: ROW_ID, projectId: PROJECT_A, name: 'Finals Night' }
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([row]) }) })
    const res = await GET(req(), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(row)
  })
})
