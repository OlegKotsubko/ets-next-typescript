// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const txMock = vi.fn()
const dbMock = { transaction: (fn: (_tx: unknown) => unknown) => txMock(fn) }
vi.mock('@/db', () => ({ db: dbMock }))

const { PUT } = await import('@/app/api/projects/[projectId]/teams/[id]/roster/route')

const PROJECT_A = '11111111-1111-1111-1111-111111111111'
const TEAM_A = '22222222-2222-2222-2222-222222222222'

describe('PUT /teams/[id]/roster', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const req = new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify({ slots: [] }) })
    const res = await PUT(req, { params: Promise.resolve({ projectId: PROJECT_A, id: TEAM_A }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 with more than 5 slots', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const slots = Array.from({ length: 6 }, (_, i) => ({ playerId: '33333333-3333-3333-3333-333333333333', slot: i }))
    const req = new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify({ slots }) })
    const res = await PUT(req, { params: Promise.resolve({ projectId: PROJECT_A, id: TEAM_A }) })
    expect(res.status).toBe(400)
  })

  it('runs the replace inside a transaction on valid input', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    txMock.mockImplementation(async (fn) => {
      const tx = { delete: vi.fn(() => ({ where: vi.fn() })), insert: vi.fn(() => ({ values: vi.fn() })) }
      return fn(tx)
    })
    const slots = [{ playerId: '33333333-3333-3333-3333-333333333333', slot: 0, isCaptain: true, isStandIn: false }]
    const req = new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify({ slots }) })
    const res = await PUT(req, { params: Promise.resolve({ projectId: PROJECT_A, id: TEAM_A }) })
    expect(txMock).toHaveBeenCalled()
    expect(res.status).toBe(200)
  })
})
