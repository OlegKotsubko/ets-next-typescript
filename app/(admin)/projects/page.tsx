import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import ProjectsGallery from './ProjectsGallery'

// proxy.ts only checks cookie presence; this is the authoritative check.
export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return <ProjectsGallery userEmail={session.user.email} />
}
