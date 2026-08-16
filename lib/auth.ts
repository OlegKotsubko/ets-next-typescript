import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'

// The Neon HTTP driver has no transaction support (`db.transaction()` throws),
// and better-auth's drizzle adapter wraps its insert-then-read-back in one — so
// sign-up (createUser + createAccount) fails outright. Degrade transactions to a
// sequential passthrough for the auth adapter only, which is exactly what the
// adapter recommends for non-transactional drivers. Safe here: low-concurrency
// admin auth, and the data layer already avoids transactions on this driver.
const authDb: typeof db = new Proxy(db, {
  get(target, prop, receiver) {
    if (prop === 'transaction') {
      return (cb: (tx: typeof db) => unknown) => cb(authDb)
    }
    return Reflect.get(target, prop, receiver)
  },
})

// disableSignUp keeps POST /api/auth/sign-up/email closed in every deploy —
// "no public sign-up" is a server property, not a missing UI. Only
// scripts/create-user.ts opts out via its own instance.
export function buildAuthOptions({ allowSignUp = false }: { allowSignUp?: boolean } = {}) {
  return {
    database: drizzleAdapter(authDb, { provider: 'pg', schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      autoSignIn: true,
    },
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL!,
  }
}

export const auth = betterAuth(buildAuthOptions())
