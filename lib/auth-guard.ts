const PROTECTED_PREFIXES = ['/projects', '/api/projects']

export type GuardDecision = 'allow' | 'redirect-login' | 'unauthorized'

// Optimistic check: proxy only sees whether the session cookie EXISTS.
// Real validation is auth.api.getSession server-side in every protected
// page / route handler (see docs/auth.md).
export function guardRequest(pathname: string, hasSessionCookie: boolean): GuardDecision {
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  if (!isProtected || hasSessionCookie) return 'allow'
  return pathname.startsWith('/api/') ? 'unauthorized' : 'redirect-login'
}
