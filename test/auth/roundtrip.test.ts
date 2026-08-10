// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
process.env.BETTER_AUTH_URL ||= 'http://localhost:3000'
const hasEnv = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET)

// Requires a migrated Neon branch (0002 applied). Skipped when env is unset.
describe.skipIf(!hasEnv)('auth round-trip', () => {
  it('blocks public sign-up, creates via script path, signs in, reads the session', async () => {
    const { betterAuth } = await import('better-auth')
    const { auth, buildAuthOptions } = await import('@/lib/auth')
    const { db } = await import('@/db')
    const { users } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const email = `e2e-${Date.now()}@example.com`
    const password = 'roundtrip-password-1'

    try {
      // 1. The app instance refuses sign-up (disableSignUp).
      await expect(
        auth.api.signUpEmail({ body: { email, password, name: email } }),
      ).rejects.toThrow()

      // 2. The script-side instance can create the user.
      const scriptAuth = betterAuth(buildAuthOptions({ allowSignUp: true }))
      await scriptAuth.api.signUpEmail({ body: { email, password, name: email } })

      // 3. Sign in on the app instance -> session cookie in the response.
      const res = await auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      })
      const setCookie = res.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain('better-auth.session_token')

      // 4. The cookie resolves back to the user server-side.
      const cookie = setCookie.split(';')[0]
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
      expect(session?.user.email).toBe(email)
    } finally {
      // Cascades to sessions + accounts.
      await db.delete(users).where(eq(users.email, email))
    }
  })
})
