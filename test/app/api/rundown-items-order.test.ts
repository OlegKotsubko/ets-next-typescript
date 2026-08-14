// @vitest-environment node
import { it, expect, vi, beforeEach } from 'vitest'
const dbMock = { select: vi.fn(), update: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
vi.mock('drizzle-orm', async (o) => { const a = await o<typeof import('drizzle-orm')>(); return { ...a, eq: vi.fn(a.eq), and: vi.fn(a.and) } })
const loadCtxMock = vi.fn()
vi.mock('@/lib/rundown-items/context', () => ({ loadItemsContext: (...a: unknown[]) => loadCtxMock(...a) }))
const { PUT } = await import('@/app/api/projects/[projectId]/rundowns/[rundownId]/items/order/route')
const P = '11111111-1111-1111-1111-111111111111', R = '22222222-2222-2222-2222-222222222222'
const A = '33333333-3333-3333-3333-333333333333', B = '44444444-4444-4444-4444-444444444444'
function req(body: unknown) { return new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify(body) }) }
function ctx() { return { params: Promise.resolve({ projectId: P, rundownId: R }) } }
function currentIds(ids: string[]) {
  dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))) }) }) })
}
beforeEach(() => { vi.clearAllMocks(); loadCtxMock.mockResolvedValue({ packageLabel: 'default' }) })

it('400 when orderedIds is not the exact set', async () => {
  currentIds([A, B])
  expect((await PUT(req({ orderedIds: [A] }), ctx())).status).toBe(400)
})
it('200 and writes index positions', async () => {
  currentIds([A, B])
  const where = vi.fn().mockResolvedValue(undefined); const set = vi.fn().mockReturnValue({ where })
  dbMock.update.mockReturnValue({ set })
  // final read-back
  dbMock.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: A }, { id: B }]) }) }) })
    .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: B, position: 0 }, { id: A, position: 1 }]) }) }) })
  const res = await PUT(req({ orderedIds: [B, A] }), ctx())
  expect(res.status).toBe(200)
  expect(set).toHaveBeenCalledWith({ position: 0 })
  expect(set).toHaveBeenCalledWith({ position: 1 })
})
