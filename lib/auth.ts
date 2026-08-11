import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'

// disableSignUp keeps POST /api/auth/sign-up/email closed in every deploy —
// "no public sign-up" is a server property, not a missing UI. Only
// scripts/create-user.ts opts out via its own instance.
export function buildAuthOptions({ allowSignUp = false }: { allowSignUp?: boolean } = {}) {
  return {
    database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
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
