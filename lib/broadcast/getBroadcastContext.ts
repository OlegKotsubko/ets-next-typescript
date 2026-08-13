// Shared by the preview and air layouts: one query for the rundown, its
// project (for project.label — the asset/CSS folder), and any custom CSS.
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rundowns, projects, projectCss } from '@/db/schema'

export interface BroadcastContext {
  rundownId: string
  rundownName: string
  projectId: string
  packageLabel: string // project.label — the overlay-package folder, never the project UUID
  css: string
}

export async function getBroadcastContext(rundownId: string): Promise<BroadcastContext | null> {
  const [row] = await db
    .select({
      rundownId: rundowns.id,
      rundownName: rundowns.name,
      projectId: projects.id,
      packageLabel: projects.label,
      css: projectCss.css,
    })
    .from(rundowns)
    .innerJoin(projects, eq(rundowns.projectId, projects.id))
    .leftJoin(projectCss, eq(projectCss.projectId, projects.id))
    .where(eq(rundowns.id, rundownId))

  if (!row) return null
  return { ...row, css: row.css ?? '' }
}
