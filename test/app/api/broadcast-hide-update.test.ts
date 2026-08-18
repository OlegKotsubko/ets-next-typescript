// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publish, getSnapshot, resetBus } from '@/lib/broadcast/bus'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const setMock = vi.fn(() => ({ where: () => Promise.resolve() }))
const dbMock = { select: vi.fn(), update: vi.fn(() => ({ set: setMock })) }
vi.mock('@/db', () => ({ db: dbMock }))

const hide = await import('@/app/api/projects/[projectId]/rundowns/[id]/broadcast/hide/route')
const hideAll = await import('@/app/api/projects/[projectId]/rundowns/[id]/broadcast/hide_all/route')
const liveUpdate = await import('@/app/api/projects/[projectId]/rundowns/[id]/broadcast/live_update/route')
const P = (o: Record<string, string>) => ({ params: Promise.resolve<any>(o) })
const body = (o: unknown) => new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })

const ov = {
  id: 9, model: 'general-text', category: 'general', template: 'Text', layer: 1,
  displayFilter: null, isFullscreen: false, data: { widget: { text: 'hi' } },
}
function mockRundown() {
  dbMock.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ id: 4, uuid: 'rd-uuid' }]) }) })
}

describe('hide/hide_all/live_update routes', () => {
  beforeEach(() => { vi.clearAllMocks(); resetBus(); getSessionMock.mockResolvedValue({ user: { id: 'u1' } }) })

  it('hide removes the overlay from the air snapshot', async () => {
    publish('rd-uuid', 'air', { type: 'air', data: [ov] })
    mockRundown()
    const res = await hide.POST(body({ overlayId: 9, channel: 'air' }), P({ projectId: '3', id: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('rd-uuid', 'air')).toEqual([])
  })
  it('hide_all clears the channel', async () => {
    publish('rd-uuid', 'air', { type: 'air', data: [ov] })
    mockRundown()
    await hideAll.POST(body({ channel: 'air' }), P({ projectId: '3', id: '4' }))
    expect(getSnapshot('rd-uuid', 'air')).toEqual([])
  })
  it('live_update publishes only can_live_update fields (general-text.text is live)', async () => {
    publish('rd-uuid', 'air', { type: 'air', data: [ov] })
    dbMock.select
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 4, uuid: 'rd-uuid' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ model: 'general-text' }]) }) })
    const res = await liveUpdate.POST(body({ overlayId: 9, widget: { text: 'new' } }), P({ projectId: '3', id: '4' }))
    expect(res.status).toBe(200)
    expect(getSnapshot('rd-uuid', 'air')[0].data.widget).toEqual({ text: 'new' })
    // the edit is also written back to the row so it survives a hide → re-show
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ data: { widget: { text: 'new' } } }))
  })
})
