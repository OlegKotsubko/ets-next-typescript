// @vitest-environment node
import { it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const dbMock = { select: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
vi.mock('drizzle-orm', async (o) => {
  const a = await o<typeof import('drizzle-orm')>()
  return { ...a, eq: vi.fn(a.eq), and: vi.fn(a.and) }
})
const getTitleModelMock = vi.fn()
vi.mock('@/lib/titles/registry', () => ({ getTitleModel: (...a: unknown[]) => getTitleModelMock(...a) }))
const loadCtxMock = vi.fn()
vi.mock('@/lib/rundown-items/context', () => ({ loadItemsContext: (...a: unknown[]) => loadCtxMock(...a) }))

const { PATCH, DELETE } = await import('@/app/api/projects/[projectId]/rundowns/[id]/items/[itemId]/route')
const P = '11111111-1111-1111-1111-111111111111', R = '22222222-2222-2222-2222-222222222222', I = '33333333-3333-3333-3333-333333333333'
function req(body?: unknown, method = 'PATCH') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}
function ctx() { return { params: Promise.resolve({ projectId: P, id: R, itemId: I }) } }
function selectReturns(rows: unknown[]) {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }) }),
  })
}
beforeEach(() => { vi.clearAllMocks(); loadCtxMock.mockResolvedValue({ packageLabel: 'default' }) })

it('PATCH 404 when the item is not in this rundown/project', async () => {
  selectReturns([])
  expect((await PATCH(req({ label: 'x' }), ctx())).status).toBe(404)
})
it('PATCH 400 when data fails the model', async () => {
  selectReturns([{ id: I, rundownId: R, projectId: P, titleKey: 'lower-third' }])
  getTitleModelMock.mockReturnValue(z.object({ playerName: z.string().min(1) }))
  expect((await PATCH(req({ data: { playerName: '' } }), ctx())).status).toBe(400)
})
it('PATCH updates label only', async () => {
  selectReturns([{ id: I, rundownId: R, projectId: P, titleKey: 'lower-third' }])
  const returning = vi.fn().mockResolvedValue([{ id: I, label: 'New' }])
  const where = vi.fn().mockReturnValue({ returning }); const set = vi.fn().mockReturnValue({ where })
  dbMock.update.mockReturnValue({ set })
  const res = await PATCH(req({ label: 'New' }), ctx())
  expect(res.status).toBe(200)
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ label: 'New' }))
})
it('DELETE 204 on success', async () => {
  selectReturns([{ id: I, rundownId: R, projectId: P }])
  const returning = vi.fn().mockResolvedValue([{ id: I }]); const where = vi.fn().mockReturnValue({ returning })
  dbMock.delete.mockReturnValue({ where })
  expect((await DELETE(req(undefined, 'DELETE'), ctx())).status).toBe(204)
})
