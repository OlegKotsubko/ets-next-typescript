// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const brackets = await import('@/app/api/projects/[projectId]/brackets/route')
const matches = await import('@/app/api/projects/[projectId]/matches/route')
const seating = await import('@/app/api/projects/[projectId]/matches/[id]/seating/route')

function json(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve(o) })

function thenable(rows: unknown[]) {
  const b: any = {
    from: () => b,
    where: () => b,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej),
  }
  return b
}

describe('brackets + matches + seatings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bracket POST stores name + structure, ignoring any participantCount', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 1, name: 'Main' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await brackets.POST(json({ name: 'Main', participantCount: 8 }), params({ projectId: '2' }))
    expect(res.status).toBe(201)
    const arg = values.mock.calls[0][0]
    expect(arg).toMatchObject({ name: 'Main', projectId: 2 })
    expect('participantCount' in arg).toBe(false)
  })

  it('match POST coerces string scores and ids to numbers', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 1 }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await matches.POST(
      json({ bracketId: '4', participantLeftId: '10', scoreLeft: '3', status: 'active' }),
      params({ projectId: '2' }),
    )
    expect(res.status).toBe(201)
    const arg = values.mock.calls[0][0]
    expect(arg).toMatchObject({ bracketId: 4, participantLeftId: 10, scoreLeft: 3, status: 'active', projectId: 2 })
    expect(typeof arg.scoreLeft).toBe('number')
  })

  it('seating PUT deactivates the other seatings then upserts', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select
      .mockReturnValueOnce(thenable([{ id: 5, projectId: 3 }])) // ownership
      .mockReturnValueOnce(thenable([{ id: 5 }, { id: 9 }]))     // project matches
    const updWhere = vi.fn().mockResolvedValue(undefined)
    const updSet = vi.fn().mockReturnValue({ where: updWhere })
    dbMock.update.mockReturnValue({ set: updSet })
    const returning = vi.fn().mockResolvedValue([{ matchId: 5, isActive: true }])
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning })
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    dbMock.insert.mockReturnValue({ values })

    const res = await seating.PUT(json({ isActive: true }), params({ projectId: '3', id: '5' }))
    expect(res.status).toBe(200)
    expect(updSet).toHaveBeenCalledWith({ isActive: false })
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ matchId: 5, isActive: true }))
  })

  it('seating PUT 404s when the match is not in the project', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select.mockReturnValueOnce(thenable([])) // ownership: none
    const res = await seating.PUT(json({ isActive: false }), params({ projectId: '3', id: '5' }))
    expect(res.status).toBe(404)
  })
})
