// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const talents = await import('@/app/api/projects/[projectId]/talents/route')
const sponsors = await import('@/app/api/projects/[projectId]/sponsors/route')

function body(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve(o) })

describe('talents + sponsors CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('talents POST returns 400 when nickname is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await talents.POST(body({}), params({ projectId: '1' }))
    expect(res.status).toBe(400)
  })

  it('talents POST inserts with the URL projectId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 1, nickname: 'Caster' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await talents.POST(body({ nickname: 'Caster' }), params({ projectId: '7' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Caster', projectId: 7 }))
  })

  it('sponsors POST coerces a string videoId to a number', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 1, name: 'ACME' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await sponsors.POST(body({ name: 'ACME', videoId: '5' }), params({ projectId: '2' }))
    expect(res.status).toBe(201)
    const arg = values.mock.calls[0][0]
    expect(arg).toMatchObject({ name: 'ACME', projectId: 2, videoId: 5 })
    expect(typeof arg.videoId).toBe('number')
  })
})
