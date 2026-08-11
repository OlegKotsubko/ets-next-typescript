// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const setMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({ set: setMock }),
}))

const { uploadAsset } = await import('@/lib/assets/upload')

describe('uploadAsset', () => {
  it('stores the file bytes under a project-scoped key and returns a permanent URL', async () => {
    const file = new File(['hello'], 'logo.png', { type: 'image/png' })
    const result = await uploadAsset('proj-1', file, 'logo')
    expect(setMock).toHaveBeenCalled()
    const [key] = setMock.mock.calls[0]
    expect(key).toContain('proj-1')
    expect(result.url).toContain('proj-1')
    expect(result.sizeBytes).toBe(5)
  })
})
