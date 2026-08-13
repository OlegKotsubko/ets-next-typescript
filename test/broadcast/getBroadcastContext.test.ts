// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbMock = { select: vi.fn() }
vi.mock('@/db', () => ({ db: dbMock }))

const { getBroadcastContext } = await import('@/lib/broadcast/getBroadcastContext')

function mockRows(rows: unknown[]) {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  })
}

describe('getBroadcastContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when the rundown does not exist', async () => {
    mockRows([])
    expect(await getBroadcastContext('missing')).toBeNull()
  })

  it('returns the joined context, defaulting a missing css row to an empty string', async () => {
    mockRows([{ rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: null }])
    expect(await getBroadcastContext('r1')).toEqual({
      rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: '',
    })
  })

  it('keeps a real css row value', async () => {
    mockRows([{
      rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: ':root{--x:1}',
    }])
    expect((await getBroadcastContext('r1'))?.css).toBe(':root{--x:1}')
  })
})
