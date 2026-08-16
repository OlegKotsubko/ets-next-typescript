// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/projects/[projectId]/themes/route')
const idRoute = await import('@/app/api/projects/[projectId]/themes/[id]/route')

function json(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve(o) })

describe('themes single-active invariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST with isActive:true deactivates siblings before inserting', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const where = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn().mockReturnValue({ where })
    dbMock.update.mockReturnValue({ set })
    const returning = vi.fn().mockResolvedValue([{ id: 1, name: 'Dark', isActive: true }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await route.POST(json({ name: 'Dark', isActive: true }), params({ projectId: '3' }))
    expect(res.status).toBe(201)
    expect(set).toHaveBeenCalledWith({ isActive: false })
  })

  it('POST with isActive:false does not deactivate siblings', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 2, name: 'Light', isActive: false }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await route.POST(json({ name: 'Light' }), params({ projectId: '3' }))
    expect(res.status).toBe(201)
    expect(dbMock.update).not.toHaveBeenCalled()
  })

  it('PATCH isActive:true deactivates the other themes, then activates this one', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const deactWhere = vi.fn().mockResolvedValue(undefined)
    const deactSet = vi.fn().mockReturnValue({ where: deactWhere })
    const updReturning = vi.fn().mockResolvedValue([{ id: 5, isActive: true }])
    const updWhere = vi.fn().mockReturnValue({ returning: updReturning })
    const updSet = vi.fn().mockReturnValue({ where: updWhere })
    dbMock.update.mockReturnValueOnce({ set: deactSet }).mockReturnValueOnce({ set: updSet })
    const res = await idRoute.PATCH(json({ isActive: true }), params({ projectId: '3', id: '5' }))
    expect(res.status).toBe(200)
    expect(deactSet).toHaveBeenCalledWith({ isActive: false })
    expect(dbMock.update).toHaveBeenCalledTimes(2)
  })
})
