# Authentication

ETS logs operators in with **username + password**, returning a **session cookie** (the etalon's identifier is `username`, not email; there are no JWTs on the client — the cookie carries the session). The monolith implements this with **better-auth** (username plugin). There is no public sign-up; the operator team creates accounts out of band with `scripts/create-user.ts`.

**Guest users.** A user flagged `is_guest` with an assigned `rundown` is a restricted operator: on login they are sent **straight to that rundown's `/controller`**, and the workspace nav/logo are hidden. `GET /api/users/me` returns `{ username, is_guest, rundown }`; the route guard/redirect uses `is_guest && rundown` to force the controller destination.

> **There is no `better-auth-next` package on npm.** Everything comes from `better-auth` itself via subpath exports: `better-auth/next-js` (route handler), `better-auth/react` (client), `better-auth/cookies` (`getSessionCookie`), `better-auth/adapters/drizzle` (adapter).

## Environment variables

```env
BETTER_AUTH_SECRET="<32-byte hex string>"          # openssl rand -hex 32
BETTER_AUTH_URL="http://localhost:3000"            # dev
# BETTER_AUTH_URL="https://ets.your-domain.tv"     # production
DATABASE_URL="postgresql://..."
```

`BETTER_AUTH_URL` must match the public origin the browser sees (your server's domain) — otherwise login cookies are dropped. On the server it lives in the systemd env file. See [deployment.md](./deployment.md#2-environment-variables).

## Server setup

The options live in a **factory** so the bootstrap script can build a second, sign-up-enabled instance without reopening the endpoint for everyone else.

```ts
// lib/auth.ts
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
```

`usePlural: true` is what maps better-auth's singular model names onto the plural tables hand-written in `db/schema.ts` (`users`, `sessions`, `accounts`, `verifications`).

```ts
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

## Client setup

```ts
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

// No baseURL: same-origin — the client is always served by the app itself.
export const authClient = createAuthClient()
export const { signIn, signOut, useSession } = authClient
```

## The login page

`/login` is the only public page in the admin surface. Per [tech-stack.md](./tech-stack.md), every admin form is **React Hook Form + `zodResolver`** — the login form is no exception.

```ts
// app/login/schema.ts
import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(3, 'At least 3 characters'),
  password: z.string().min(8, 'At least 8 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>
```

`app/login/page.tsx` wires that schema into `useForm({ resolver: zodResolver(loginSchema) })`, renders MUI `TextField`s with `helperText={errors.<field>?.message}`, and submits through `signIn.username(values)`. A returned `result.error` is surfaced in an `Alert`; success loads `GET /api/users/me` and routes to `/projects` (or, for a guest user, straight to their rundown's `/controller`).

The layout is a centered card on a dark background: weplay studios logo, Username + Password fields, full-width "Sign in" button.

## Protecting admin routes

Next.js 16 renamed `middleware.ts` to **`proxy.ts`** (named export `proxy`, same `config.matcher` semantics). **Next 15.x silently ignores `proxy.ts`**, which is why the app is pinned to `next@^16`.

The decision logic is factored into a pure, unit-testable helper:

```ts
// lib/auth-guard.ts
const PROTECTED_PREFIXES = ['/projects', '/api/projects']

export type GuardDecision = 'allow' | 'redirect-login' | 'unauthorized'

// Optimistic check: proxy only sees whether the session cookie EXISTS.
// Real validation is auth.api.getSession server-side in every protected
// page / route handler.
export function guardRequest(pathname: string, hasSessionCookie: boolean): GuardDecision {
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  if (!isProtected || hasSessionCookie) return 'allow'
  return pathname.startsWith('/api/') ? 'unauthorized' : 'redirect-login'
}
```

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { guardRequest } from '@/lib/auth-guard'

export function proxy(req: NextRequest) {
  const decision = guardRequest(req.nextUrl.pathname, Boolean(getSessionCookie(req)))
  if (decision === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (decision === 'redirect-login') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/projects/:path*', '/api/projects/:path*'],
}
```

Note the asymmetry: **API paths get `401`, pages get a redirect.** A fetch shouldn't receive an HTML login page.

> **The cookie check is optimistic** — it proves a cookie is *present*, not that it's *valid*. Every protected page and route handler must additionally call `auth.api.getSession`.

> **`/preview/*` and `/air/*` are intentionally public.** Anyone with the URL can render the graphics (OBS does not authenticate). Treat rundown IDs as unguessable tokens (UUIDs) rather than secrets. The matcher deliberately covers only `/projects/*` and `/api/projects/*` — `/api/auth/*` and `/api/broadcast/*` must stay open.

## Reading the session in server code

This is the authoritative check, and the pattern every protected page repeats:

```tsx
// app/(admin)/projects/page.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')
  // ... render, using session.user.username / session.user.id
}
```

In Route Handlers, read the session the same way and return `401` if missing.

## Logout

```tsx
// app/(admin)/projects/SignOutButton.tsx
'use client'

import { Button } from '@mui/material'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'

export default function SignOutButton() {
  const router = useRouter()
  return (
    <Button
      variant="outlined"
      onClick={() => signOut().then(() => router.push('/login'))}
    >
      Sign out
    </Button>
  )
}
```

## Bootstrapping the first user

There's no public registration — `disableSignUp` closes the endpoint. To create an operator:

```bash
npx tsx scripts/create-user.ts you@example.com 'a-strong-password'
```

```ts
// scripts/create-user.ts
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const [, , email, password] = process.argv
if (!email || !password) {
  console.error('Usage: npx tsx scripts/create-user.ts <email> <password>')
  process.exit(1)
}

// Wrapped in main() rather than top-level await: the repo has no "type":"module",
// so tsx transpiles this to CJS, where top-level await is unavailable.
async function main() {
  // Dynamic imports so dotenv runs before @/lib/auth reads process.env.
  const { betterAuth } = await import('better-auth')
  const { buildAuthOptions } = await import('../lib/auth')

  const auth = betterAuth(buildAuthOptions({ allowSignUp: true }))

  try {
    await auth.api.signUpEmail({ body: { email, password, name: email } })
    console.log(`Created ${email}`)
  } catch (err) {
    console.error(`Failed to create ${email}:`, err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

void main()
```

The script builds its **own** better-auth instance with `allowSignUp: true`. The app's exported `auth` stays closed.

## Session shape

The session returned by `auth.api.getSession` contains `user.id`, `user.username`, and `session.expiresAt`; `GET /api/users/me` returns the operator-facing `{ username, is_guest, rundown }`. `rundowns.user_id` and `settings.user_id` reference `user.id`.

## Troubleshooting

- **Login succeeds in the network tab but `/projects` redirects back to `/login`** — `BETTER_AUTH_URL` doesn't match the origin. Cookies are dropped because the cookie domain doesn't match.
- **`BETTER_AUTH_SECRET` errors in production but works locally** — the variable isn't in the server's env file (`/etc/ets/ets.env`), or the service wasn't restarted after adding it. Set it and `sudo systemctl restart ets`.
- **Sign-up returns 4xx / `SIGNUP_DISABLED`** — working as designed (`disableSignUp`). Use `scripts/create-user.ts`.
- **`proxy.ts` never runs** — you're on Next 15.x, which silently ignores it. The app requires `next@^16`.
- **Top-level await fails in a script** — the repo has no `"type": "module"`, so tsx emits CJS. Wrap in an async `main()`.
