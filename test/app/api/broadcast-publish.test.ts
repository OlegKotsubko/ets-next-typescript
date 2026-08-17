// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSnapshot, resetBus } from '@/lib/broadcast/bus'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const preview = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/preview/route')
const air = await import('@/app/api/projects/[projectId]/broadcast/[displayId]/air/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

// db.select() is called twice per handler: display lookup then overlay lookup.
function mockLookups(display: unknown, overlay: unknown) {
  dbMock.select
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([display]) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([overlay]) }) })
}
const overlayRow = {
  id: 9, model: 'general-text', category: 'general', template: 'Text', layer: 2,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}

describe('preview/air publisher routes', () => {
  beforeEach(() => { vi.clearAllMocks(); resetBus(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('preview publishes the overlay onto the display preview snapshot', async () => {
    mockLookups({ id: 4, uuid: 'disp-uuid' }, overlayRow)
    const res = await preview.POST(body({ overlayId: 9 }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('disp-uuid', 'preview').map((o) => o.id)).toEqual([9])
  })
  it('air with a full-screen overlay clears the air set first', async () => {
    mockLookups({ id: 4, uuid: 'disp-uuid' }, { ...overlayRow, isFullscreen: true })
    const res = await air.POST(body({ overlayId: 9 }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('disp-uuid', 'air').map((o) => o.id)).toEqual([9])
  })
  it('air 404 when the display is missing', async () => {
    mockLookups(undefined, overlayRow)
    const res = await air.POST(body({ overlayId: 9 }), P({ projectId: '3', displayId: '4' }))
    expect(res.status).toBe(404)
  })
})
