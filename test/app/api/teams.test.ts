// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/projects/[projectId]/teams/route')

function body(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })

describe('teams composite route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST writes the team plus its logos and roster', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const teamReturning = vi.fn().mockResolvedValue([{ id: 4, projectId: 2, name: 'Alpha' }])
    const teamValues = vi.fn().mockReturnValue({ returning: teamReturning })
    const logoValues = vi.fn().mockResolvedValue(undefined)
    const rosterValues = vi.fn().mockResolvedValue(undefined)
    dbMock.insert
      .mockReturnValueOnce({ values: teamValues })
      .mockReturnValueOnce({ values: logoValues })
      .mockReturnValueOnce({ values: rosterValues })
    const res = await route.POST(
      body({
        name: 'Alpha',
        logos: [{ photoType: 'logo', url: 'https://x/l.png' }],
        roster: [{ playerId: 9, isCaptain: true, isStandIn: false }],
      }),
      params({ projectId: '2' }),
    )
    expect(res.status).toBe(201)
    expect(teamValues.mock.calls[0][0]).toMatchObject({ name: 'Alpha', projectId: 2 })
    expect(logoValues).toHaveBeenCalledWith([{ photoType: 'logo', url: 'https://x/l.png', teamId: 4 }])
    expect(rosterValues).toHaveBeenCalledWith([{ playerId: 9, isCaptain: true, isStandIn: false, teamId: 4 }])
  })

  it('POST rejects a name shorter than 2 chars', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await route.POST(body({ name: 'A' }), params({ projectId: '2' }))
    expect(res.status).toBe(400)
  })

  it('POST rejects a roster larger than 10', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const roster = Array.from({ length: 11 }, (_, i) => ({ playerId: i + 1 }))
    const res = await route.POST(body({ name: 'Alpha', roster }), params({ projectId: '2' }))
    expect(res.status).toBe(400)
  })
})
