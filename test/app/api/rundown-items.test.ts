// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(actual.eq), and: vi.fn(actual.and), desc: vi.fn(actual.desc) }
})

const getTitleModelMock = vi.fn()
vi.mock('@/lib/titles/registry', () => ({ getTitleModel: (...a: unknown[]) => getTitleModelMock(...a) }))

// loadItemsContext resolves the label via a single joined query; stub it directly
// so these tests focus on the handler logic.
const loadCtxMock = vi.fn()
vi.mock('@/lib/rundown-items/context', () => ({ loadItemsContext: (...a: unknown[]) => loadCtxMock(...a) }))

const { POST, GET } = await import('@/app/api/projects/[projectId]/rundowns/[rundownId]/items/route')

const P = '11111111-1111-1111-1111-111111111111'
const R = '22222222-2222-2222-2222-222222222222'
function req(body?: unknown, method = 'POST') {
  return new Request('http://localhost/x', { method, body: body ? JSON.stringify(body) : undefined })
}
function ctx() { return { params: Promise.resolve({ projectId: P, rundownId: R }) } }

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
  loadCtxMock.mockResolvedValue({ packageLabel: 'default' })
})

describe('POST items', () => {
  it('401 when loadItemsContext returns a Response', async () => {
    loadCtxMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    const res = await POST(req({ titleKey: 'lower-third' }), ctx())
    expect(res.status).toBe(401)
  })

  it('400 on unknown titleKey', async () => {
    getTitleModelMock.mockReturnValue(undefined)
    const res = await POST(req({ titleKey: 'nope' }), ctx())
    expect(res.status).toBe(400)
  })

  it('400 when data fails the title model', async () => {
    getTitleModelMock.mockReturnValue(z.object({ playerName: z.string().min(1) }))
    const res = await POST(req({ titleKey: 'lower-third', data: { playerName: '' } }), ctx())
    expect(res.status).toBe(400)
  })

  it('201, position auto-appended, projectId+rundownId from URL', async () => {
    getTitleModelMock.mockReturnValue(z.object({ playerName: z.string().min(1) }))
    // max(position) query → returns [{ position: 4 }]
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ position: 4 }]) }) }) }) })
    const row = { id: 'i1', rundownId: R, projectId: P, titleKey: 'lower-third', position: 5 }
    const returning = vi.fn().mockResolvedValue([row])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const res = await POST(req({ titleKey: 'lower-third', data: { playerName: 'Jo' }, projectId: 'evil' }), ctx())
    expect(res.status).toBe(201)
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ projectId: P, rundownId: R, position: 5, titleKey: 'lower-third' }))
  })
})
