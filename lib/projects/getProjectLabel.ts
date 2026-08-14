import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects } from '@/db/schema'

// project.label — the overlay-package folder that owns the title registry for
// this project. Never the project UUID.
export async function getProjectLabel(projectId: string): Promise<string | null> {
  const [row] = await db.select({ label: projects.label }).from(projects).where(eq(projects.id, projectId)).limit(1)
  return row?.label ?? null
}
