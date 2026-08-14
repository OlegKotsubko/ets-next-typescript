// @vitest-environment node
import { it, expect, vi, beforeEach } from 'vitest'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }))
const getProjectLabelMock = vi.fn()
vi.mock('@/lib/projects/getProjectLabel', () => ({ getProjectLabel: (...a: unknown[]) => getProjectLabelMock(...a) }))
const listTitleOptionsMock = vi.fn()
vi.mock('@/lib/titles/listTitleOptions', () => ({ listTitleOptions: (...a: unknown[]) => listTitleOptionsMock(...a) }))

const { GET } = await import('@/app/api/projects/[projectId]/titles/route')
const P = '11111111-1111-1111-1111-111111111111'
function req() { return new Request('http://localhost/x') }
function ctx() { return { params: Promise.resolve({ projectId: P }) } }
beforeEach(() => vi.clearAllMocks())

it('401 with no session', async () => {
  getSessionMock.mockResolvedValue(null)
  expect((await GET(req(), ctx())).status).toBe(401)
})
it('404 when the project has no label', async () => {
  getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
  getProjectLabelMock.mockResolvedValue(null)
  expect((await GET(req(), ctx())).status).toBe(404)
})
it('200 returns the title options for the project label', async () => {
  getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
  getProjectLabelMock.mockResolvedValue('default')
  const options = [{ key: 'lower-third', name: 'Lower Third', color: 'red', isFullScreen: false, fields: [], defaults: {} }]
  listTitleOptionsMock.mockReturnValue(options)
  const res = await GET(req(), ctx())
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(options)
  expect(listTitleOptionsMock).toHaveBeenCalledWith('default')
})
