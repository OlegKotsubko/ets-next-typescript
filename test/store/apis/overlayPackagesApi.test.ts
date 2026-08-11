import { describe, it, expect } from 'vitest'
import { overlayPackagesApi } from '@/store/apis/overlayPackagesApi'

describe('overlayPackagesApi', () => {
  it('exposes a listOverlayPackages endpoint', () => {
    expect(Object.keys(overlayPackagesApi.endpoints)).toEqual(
      expect.arrayContaining(['listOverlayPackages']),
    )
  })
})
