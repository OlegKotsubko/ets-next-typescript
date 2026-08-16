// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const overlays = await import('@/app/api/projects/[projectId]/rundowns/[id]/overlays/route')
const overlayItem = await import('@/app/api/projects/[projectId]/rundowns/[id]/overlays/[overlayId]/route')
const reorder = await import('@/app/api/projects/[projectId]/rundowns/[id]/overlays/reorder/route')

function body(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const P = (o: Record<string, string>) => ({ params: Promise.resolve(o) })

describe('rundown_overlays routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST returns 400 on an unknown overlay model', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await overlays.POST(body({ model: 'nope' }), P({ projectId: '3', id: '2' }))
    expect(res.status).toBe(400)
  })

  it('POST derives registry fields + default widget, using the URL projectId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) })
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1 }]) })
    dbMock.insert.mockReturnValue({ values })
    const res = await overlays.POST(body({ model: 'general-text' }), P({ projectId: '3', id: '2' }))
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      model: 'general-text', category: 'general', template: 'Text', widgetName: 'Text',
      projectId: 3, rundownId: 2, order: 0, data: { widget: { text: 'Text sample' } },
    }))
  })

  it('PATCH rejects an invalid widget field', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ model: 'general-text' }]) }) })
    const res = await overlayItem.PATCH(body({ widget: { text: 123 } }), P({ projectId: '3', id: '2', overlayId: '9' }))
    expect(res.status).toBe(400)
  })

  it('PATCH accepts a valid widget field and stores it under data.widget', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    dbMock.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ model: 'general-text' }]) }) })
    const set = vi.fn().mockReturnValue({ where: () => ({ returning: () => Promise.resolve([{ id: 9 }]) }) })
    dbMock.update.mockReturnValue({ set })
    const res = await overlayItem.PATCH(body({ widget: { text: 'Hi' } }), P({ projectId: '3', id: '2', overlayId: '9' }))
    expect(res.status).toBe(200)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ data: { widget: { text: 'Hi' } } }))
  })

  it('reorder rewrites order sequentially', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const set = vi.fn().mockReturnValue({ where: () => Promise.resolve(undefined) })
    dbMock.update.mockReturnValue({ set })
    const res = await reorder.POST(body({ orderedIds: [30, 10, 20] }), P({ projectId: '3', id: '2' }))
    expect(res.status).toBe(204)
    expect(set.mock.calls.map((c) => c[0])).toEqual([{ order: 0 }, { order: 1 }, { order: 2 }])
  })
})
