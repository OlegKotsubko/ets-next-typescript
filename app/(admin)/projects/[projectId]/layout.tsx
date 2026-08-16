import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Box, Typography } from '@mui/material'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { projects } from '@/db/schema'
import WorkspaceNav from './WorkspaceNav'

// proxy.ts only checks cookie presence; this is the authoritative check,
// covering every page under /projects/[projectId]/* (data/*, rundowns/*).
export default async function ProjectWorkspaceLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const { projectId } = await params
  const [project] = await db.select().from(projects).where(eq(projects.id, Number(projectId)))
  if (!project) notFound()

  return (
    <Box>
      <Box sx={{ px: 4, pt: 3 }}>
        <Typography variant="h5">
          {project.title}
        </Typography>
      </Box>
      <Box sx={{ px: 4 }}>
        <WorkspaceNav projectId={projectId} />
      </Box>
      {children}
    </Box>
  )
}
