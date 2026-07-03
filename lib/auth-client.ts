import { createAuthClient } from 'better-auth/react'

// No baseURL: same-origin — the client is always served by the app itself.
export const authClient = createAuthClient()
export const { signIn, signOut, useSession } = authClient
