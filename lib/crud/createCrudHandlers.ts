import { and, eq, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '@/db'
import { auth } from '@/lib/auth'

type AnyTable = {
  id: { name: string }
  projectId: { name: string }
} & Record<string, unknown>

type Params = { projectId: string; id?: string }

async function requireSession(req: Request): Promise<Response | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  return null
}

export function createCrudHandlers<TTable extends AnyTable>(config: {
  table: TTable
  createSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
}) {
  const { table, createSchema, updateSchema } = config

  return {
    async GET(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId } = await params
      const rows = await db.select().from(table as never).where(eq(table.projectId as never, projectId))
      return Response.json(rows)
    },

    async POST(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId } = await params
      const body = await req.json()
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
      const [row] = await db.insert(table as never).values({
        ...parsed.data,
        projectId,
      } as never).returning()
      return Response.json(row, { status: 201 })
    },

    async PATCH(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId, id } = await params
      const body = await req.json()
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
      const filter = and(
        eq(table.id as never, id as string),
        eq(table.projectId as never, projectId),
      ) as SQL
      const [row] = await db.update(table as never)
        .set({ ...parsed.data, updatedAt: new Date() } as never)
        .where(filter)
        .returning()
      if (!row) return new Response('Not found', { status: 404 })
      return Response.json(row)
    },

    async DELETE(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId, id } = await params
      const filter = and(
        eq(table.id as never, id as string),
        eq(table.projectId as never, projectId),
      ) as SQL
      const [row] = await db.delete(table as never).where(filter).returning()
      if (!row) return new Response('Not found', { status: 404 })
      return new Response(null, { status: 204 })
    },
  }
}
