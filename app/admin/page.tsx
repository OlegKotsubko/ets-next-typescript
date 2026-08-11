import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AdminGallery from './AdminGallery'

// proxy.ts only checks cookie presence; this is the authoritative check.
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return <AdminGallery userEmail={session.user.email} />
}
