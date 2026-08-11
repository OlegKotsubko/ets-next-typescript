// @vitest-environment node
import { describe, it, expect } from 'vitest'

// Dummy env so importing @/lib/auth (which pulls in @/db) never needs a live DB.
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'
process.env.BETTER_AUTH_SECRET ||= 'test-secret-at-least-32-chars-long!!'
process.env.BETTER_AUTH_URL ||= 'http://localhost:3000'

describe('buildAuthOptions', () => {
  it('disables public sign-up by default', async () => {
    const { buildAuthOptions } = await import('@/lib/auth')
    expect(buildAuthOptions().emailAndPassword.disableSignUp).toBe(true)
  })
  it('enables sign-up only when explicitly asked (create-user script)', async () => {
    const { buildAuthOptions } = await import('@/lib/auth')
    expect(buildAuthOptions({ allowSignUp: true }).emailAndPassword.disableSignUp).toBe(false)
  })
  it('exports a live auth instance with a server API', async () => {
    const { auth } = await import('@/lib/auth')
    expect(typeof auth.api.getSession).toBe('function')
    expect(typeof auth.api.signInEmail).toBe('function')
  })
  it('the catch-all route exports GET and POST handlers', async () => {
    const route = await import('@/app/api/auth/[...all]/route')
    expect(typeof route.GET).toBe('function')
    expect(typeof route.POST).toBe('function')
  })
})
