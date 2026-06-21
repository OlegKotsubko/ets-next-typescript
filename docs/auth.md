# Authentication

ETS uses **better-auth-next** with email + password. There is no public sign-up; the operator team creates user accounts out of band (a script, or the database directly).

## Environment variables

```env
BETTER_AUTH_SECRET="<32-byte hex string>"
BETTER_AUTH_URL="http://localhost:3000"           # dev
# BETTER_AUTH_URL="https://yourapp.netlify.app"   # production
DATABASE_URL="postgresql://..."
```

`BETTER_AUTH_URL` must match the origin the browser sees. In Netlify Deploy Previews the URL is dynamic — use `process.env.DEPLOY_PRIME_URL` to construct it. See [deployment.md](./deployment.md).

## Server setup

```ts
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
});
```

```ts
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

## Client setup

```ts
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL ?? '',
});

export const { signIn, signOut, useSession } = authClient;
```

## The login page

`/login` is the only public page in the admin surface. Email + password, validated client-side with Zod, submitted via better-auth's client helper.

```ts
// app/login/schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

```tsx
// app/login/page.tsx (sketch — MUI form, full code in repo)
'use client';

import { useState } from 'react';
import { TextField, Button, Box, Typography } from '@mui/material';
import { signIn } from '@/lib/auth-client';
import { loginSchema } from './schema';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(formData: FormData) {
    const parsed = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(i => [i.path[0], i.message])));
      return;
    }
    const result = await signIn.email(parsed.data);
    if (result.error) {
      setErrors({ form: result.error.message });
      return;
    }
    router.push('/admin');
  }

  // Render MUI form — matches Screenshot 1 (centered, dark, "SIGN IN" button)
}
```

The form layout matches **Screenshot 1**: centered card on a dark background, weplay studios logo, Login + Password fields, full-width blue "SIGN IN" button.

## Protecting admin routes

Use Next.js middleware to gate every `/admin/*` and `/api/projects/*` path:

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PROTECTED = ['/admin', '/api/projects'];

export function middleware(req: NextRequest) {
  const needsAuth = PROTECTED.some(p => req.nextUrl.pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const session = getSessionCookie(req);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/projects/:path*'],
};
```

> **`/preview/*` and `/air/*` are intentionally public.** Anyone with the URL can render the graphics (OBS does not authenticate). Treat rundown IDs as unguessable tokens (UUIDs) rather than secrets.

## Reading the session in server code

```ts
// app/admin/page.tsx
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  // ... fetch projects, render gallery
}
```

In Route Handlers, read the session the same way and return `401` if missing.

## Logout

```tsx
import { signOut } from '@/lib/auth-client';

<Button onClick={() => signOut().then(() => router.push('/login'))}>
  Sign out
</Button>
```

## Bootstrapping the first user

There's no public registration. To create the first operator, run:

```bash
npx tsx scripts/create-user.ts you@example.com 'a-strong-password'
```

```ts
// scripts/create-user.ts
import { auth } from '@/lib/auth';

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: create-user.ts <email> <password>');
  process.exit(1);
}

await auth.api.signUpEmail({ body: { email, password, name: email } });
console.log(`Created ${email}`);
```

## Session shape

The session returned by `auth.api.getSession` contains `user.id`, `user.email`, `user.name`, and `session.expiresAt`. Use `user.id` for audit columns later (creator/updater fields) — not in MVP.

## Troubleshooting

- **Login succeeds in the network tab but `/admin` redirects back to `/login`** — `BETTER_AUTH_URL` doesn't match the origin. Cookies are dropped because the cookie domain doesn't match.
- **`BETTER_AUTH_SECRET` errors in production but works locally** — the env var didn't propagate to the Netlify context. Verify it's set for **Production** (not just **Deploy Previews**) in Netlify's environment-variables UI.
- **`Cannot find module 'better-auth/next-js'`** — make sure both `better-auth` and `better-auth-next` are installed; the Next.js helper is exported from the adapter package.
