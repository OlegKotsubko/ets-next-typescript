// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { guardRequest } from '@/lib/auth-guard'

describe('guardRequest', () => {
  it('redirects logged-out page requests under /admin to login', () => {
    expect(guardRequest('/admin', false)).toBe('redirect-login')
    expect(guardRequest('/admin/some-project/data', false)).toBe('redirect-login')
  })
  it('401s logged-out API requests under /api/projects', () => {
    expect(guardRequest('/api/projects', false)).toBe('unauthorized')
    expect(guardRequest('/api/projects/abc/players', false)).toBe('unauthorized')
  })
  it('allows protected paths when the session cookie is present', () => {
    expect(guardRequest('/admin', true)).toBe('allow')
    expect(guardRequest('/api/projects/abc', true)).toBe('allow')
  })
  it('never touches public paths', () => {
    for (const p of ['/login', '/', '/preview/some-id', '/air/some-id', '/api/auth/sign-in/email', '/api/broadcast/x/stream']) {
      expect(guardRequest(p, false)).toBe('allow')
    }
  })
  it('does not treat prefix look-alikes as protected', () => {
    expect(guardRequest('/administrator', false)).toBe('allow')
  })
})
