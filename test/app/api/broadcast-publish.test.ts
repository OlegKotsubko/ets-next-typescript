// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSnapshot, resetBus } from '@/lib/broadcast/bus'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const setMock = vi.fn(() => ({ where: () => Promise.resolve() }))
const dbMock = { select: vi.fn(), update: vi.fn(() => ({ set: setMock })) }
vi.mock('@/db', () => ({ db: dbMock }))

const preview = await import('@/app/api/projects/[projectId]/rundowns/[id]/broadcast/preview/route')
const air = await import('@/app/api/projects/[projectId]/rundowns/[id]/broadcast/air/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

// db.select() is called twice per handler: rundown lookup then overlay lookup.
function mockLookups(rundown: unknown, overlay: unknown) {
  dbMock.select
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([rundown]) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([overlay]) }) })
}
const overlayRow = {
  id: 9, model: 'general-text', category: 'general', template: 'Text', layer: 2,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}

describe('preview/air publisher routes', () => {
  beforeEach(() => { vi.clearAllMocks(); resetBus(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('preview publishes the overlay onto the rundown preview snapshot', async () => {
    mockLookups({ id: 4, uuid: 'rd-uuid' }, overlayRow)
    const res = await preview.POST(body({ overlayId: 9 }), P({ projectId: '3', id: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('rd-uuid', 'preview').map((o) => o.id)).toEqual([9])
  })
  it('air with a full-screen overlay clears the air set first', async () => {
    mockLookups({ id: 4, uuid: 'rd-uuid' }, { ...overlayRow, isFullscreen: true })
    const res = await air.POST(body({ overlayId: 9 }), P({ projectId: '3', id: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('rd-uuid', 'air').map((o) => o.id)).toEqual([9])
  })
  it('air 404 when the rundown is missing', async () => {
    // The handler returns after the rundown lookup, so queue only that one —
    // a dangling second mockReturnValueOnce would bleed into the next test.
    dbMock.select.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([undefined]) }) })
    const res = await air.POST(body({ overlayId: 9 }), P({ projectId: '3', id: '4' }))
    expect(res.status).toBe(404)
  })
  it('preview with an edited widget persists it to the overlay row (survives re-show)', async () => {
    mockLookups({ id: 4, uuid: 'rd-uuid' }, overlayRow)
    const res = await preview.POST(body({ overlayId: 9, widget: { text: 'Home' } }), P({ projectId: '3', id: '4' }))
    expect(res.status).toBe(200)
    // staged with the edit …
    expect(getSnapshot('rd-uuid', 'preview')[0].data.widget).toEqual({ text: 'Home' })
    // … and written back to the row so a later re-stage re-reads it
    expect(dbMock.update).toHaveBeenCalled()
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ data: { widget: { text: 'Home' } } }))
  })
})
