// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { pgTable, serial, integer, text } from 'drizzle-orm/pg-core'

const getSessionMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } } }))

const dbMock = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}
vi.mock('@/db', () => ({ db: dbMock }))

const { createCrudHandlers } = await import('@/lib/crud/createCrudHandlers')

const widgets = pgTable('widgets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  name: text('name').notNull(),
})
const createSchema = z.object({ name: z.string().min(1) })
const updateSchema = createSchema.partial()

// Route params arrive as strings; the handler must coerce them to integers.
const PROJECT_A = '1'
const ROW_IN_A = '2'

function req(body?: unknown) {
  return new Request('http://localhost/x', { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

describe('createCrudHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 with no session', async () => {
    getSessionMock.mockResolvedValue(null)
    const { GET } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await GET(req(), { params: Promise.resolve({ projectId: PROJECT_A }) })
    expect(res.status).toBe(401)
  })

  it('POST returns 400 on invalid body', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const { POST } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await POST(req({ name: '' }), { params: Promise.resolve({ projectId: PROJECT_A }) })
    expect(res.status).toBe(400)
  })

  it('POST inserts an INTEGER projectId from the URL, ignoring any body projectId', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 2, projectId: 1, name: 'x' }])
    const values = vi.fn().mockReturnValue({ returning })
    dbMock.insert.mockReturnValue({ values })
    const { POST } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    await POST(req({ name: 'x', projectId: 'attacker' }), { params: Promise.resolve({ projectId: PROJECT_A }) })
    const arg = values.mock.calls[0][0]
    expect(arg).toMatchObject({ name: 'x', projectId: 1 })
    expect(typeof arg.projectId).toBe('number')
  })

  it('PATCH returns 404 when the row belongs to a different project', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([]) // no row matched the (id, projectId) filter
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    dbMock.update.mockReturnValue({ set })
    const { PATCH } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await PATCH(req({ name: 'y' }), { params: Promise.resolve({ projectId: PROJECT_A, id: ROW_IN_A }) })
    expect(res.status).toBe(404)
  })

  it('DELETE returns 204 when the row is deleted', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const returning = vi.fn().mockResolvedValue([{ id: 2 }])
    const where = vi.fn().mockReturnValue({ returning })
    dbMock.delete.mockReturnValue({ where })
    const { DELETE } = createCrudHandlers({ table: widgets as never, createSchema, updateSchema })
    const res = await DELETE(req(), { params: Promise.resolve({ projectId: PROJECT_A, id: ROW_IN_A }) })
    expect(res.status).toBe(204)
  })
})
