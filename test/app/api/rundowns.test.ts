// test/app/api/rundowns.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(actual.eq), and: vi.fn(actual.and) }
})

const { eq } = await import('drizzle-orm')
const { rundowns } = await import('@/db/schema')
const { GET, POST } = await import('@/app/api/projects/[projectId]/rundowns/route')

const PROJECT_A = '11111111-1111-1111-1111-111111111111'

function req(body?: unknown, method = 'POST') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}

function ctx(projectId = PROJECT_A) {
  return { params: Promise.resolve({ projectId }) }
}

describe('GET/POST /api/projects/[projectId]/rundowns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(req(undefined, 'GET'), ctx())
    expect(res.status).toBe(401)
  })

  it('GET returns rows scoped to projectId on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const rows = [{ id: 'r1', projectId: PROJECT_A, name: 'Finals Night' }]
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }) })
    const res = await GET(req(undefined, 'GET'), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(rows)
    expect(eq).toHaveBeenCalledWith(rundowns.projectId, PROJECT_A)
  })

  it('POST returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await POST(req({ name: 'Finals Night' }), ctx())
    expect(res.status).toBe(401)
  })

  it('POST returns 400 on empty name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({ name: '' }), ctx())
    expect(res.status).toBe(400)
  })

  it('POST returns 400 on missing name', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(400)
  })

  it('POST returns 201 and the inserted row, projectId taken from the URL not the body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const row = { id: 'r1', projectId: PROJECT_A, name: 'Finals Night' }
    const returning = vi.fn().mockResolvedValue([row])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await POST(req({ name: 'Finals Night', projectId: 'someone-elses-id' }), ctx())
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(row)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT_A, name: 'Finals Night' }))
  })
})
