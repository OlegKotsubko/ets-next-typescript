// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))

const dbMock = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const route = await import('@/app/api/projects/[projectId]/players/route')
const idRoute = await import('@/app/api/projects/[projectId]/players/[id]/route')

function body(o: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(o) })
}
const params = (o: Record<string, string>) => ({ params: Promise.resolve(o) })

describe('players composite route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST inserts the player (URL projectId wins) and a linked photo row', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const playerReturning = vi.fn().mockResolvedValue([{ id: 7, projectId: 3, nickname: 'x' }])
    const playerValues = vi.fn().mockReturnValue({ returning: playerReturning })
    const photoValues = vi.fn().mockResolvedValue(undefined)
    dbMock.insert
      .mockReturnValueOnce({ values: playerValues })
      .mockReturnValueOnce({ values: photoValues })
    const res = await route.POST(
      body({ nickname: 'x', projectId: 999, photos: [{ photoType: 'avatar', url: 'https://x/a.png' }] }),
      params({ projectId: '3' }),
    )
    expect(res.status).toBe(201)
    const inserted = playerValues.mock.calls[0][0]
    expect(inserted).toMatchObject({ nickname: 'x', projectId: 3 })
    expect('photos' in inserted).toBe(false)
    expect(photoValues).toHaveBeenCalledWith([{ photoType: 'avatar', url: 'https://x/a.png', playerId: 7 }])
  })

  it('POST returns 400 when nickname is missing', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await route.POST(body({ photos: [] }), params({ projectId: '3' }))
    expect(res.status).toBe(400)
  })

  it('PATCH replaces photos when the field is present', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 7, projectId: 3 }])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    dbMock.update.mockReturnValue({ set })
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
    const photoValues = vi.fn().mockResolvedValue(undefined)
    dbMock.insert.mockReturnValue({ values: photoValues })
    const res = await idRoute.PATCH(
      body({ photos: [{ photoType: 'left', url: 'https://x/l.png' }] }),
      params({ projectId: '3', id: '7' }),
    )
    expect(res.status).toBe(200)
    expect(dbMock.delete).toHaveBeenCalled()
    expect(photoValues).toHaveBeenCalledWith([{ photoType: 'left', url: 'https://x/l.png', playerId: 7 }])
  })

  it('PATCH leaves photos untouched when the field is absent', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 7, projectId: 3 }])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    dbMock.update.mockReturnValue({ set })
    const res = await idRoute.PATCH(body({ nickname: 'y' }), params({ projectId: '3', id: '7' }))
    expect(res.status).toBe(200)
    expect(dbMock.delete).not.toHaveBeenCalled()
  })
})
