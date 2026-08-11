// test/app/api/overlay-packages.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const { GET } = await import('@/app/api/overlay-packages/route')

describe('GET /api/overlay-packages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/x'))
    expect(res.status).toBe(401)
  })

  it('returns the default package (present on disk) with the expected shape', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await GET(new Request('http://localhost/x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'default', name: expect.any(String) }),
      ]),
    )
  })
})
