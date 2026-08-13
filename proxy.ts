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
