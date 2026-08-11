import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import LoginForm from './LoginForm'

// Already-authenticated visitors shouldn't see the login form again.
export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect('/admin')

  return <LoginForm />
}
