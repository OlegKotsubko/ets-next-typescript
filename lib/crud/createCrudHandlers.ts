import { and, eq } from 'drizzle-orm'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'
import type { z } from 'zod'
import { db } from '@/db'
import { auth } from '@/lib/auth'

type AnyTable = PgTable & {
  id: PgColumn
  projectId: PgColumn
}

type Params = { projectId: string; id?: string }

async function requireSession(req: Request): Promise<Response | null> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new Response('Unauthorized', { status: 401 })
  return null
}

// The generic table shape varies per entity, and Drizzle's query builder overloads don't
// unify cleanly across arbitrary tables — this factory relies on tests (not the type
// checker) to prove runtime correctness, so internals use `any` deliberately.
 
export function createCrudHandlers<TTable extends AnyTable>(config: {
  table: TTable
  createSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
}) {
  const { table, createSchema, updateSchema } = config
  const db_ = db as any

  return {
    async GET(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId } = await params
      const rows = await db_.select().from(table).where(eq(table.projectId, projectId))
      return Response.json(rows)
    },

    async POST(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId } = await params
      const body = await req.json()
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
      const [row] = await db_.insert(table).values({
        ...parsed.data,
        projectId,
      }).returning()
      return Response.json(row, { status: 201 })
    },

    async PATCH(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId, id } = await params
      const body = await req.json()
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 })
      const filter = and(eq(table.id, id as string), eq(table.projectId, projectId))
      const [row] = await db_.update(table)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(filter)
        .returning()
      if (!row) return new Response('Not found', { status: 404 })
      return Response.json(row)
    },

    async DELETE(req: Request, { params }: { params: Promise<Params> }) {
      const unauthorized = await requireSession(req)
      if (unauthorized) return unauthorized
      const { projectId, id } = await params
      const filter = and(eq(table.id, id as string), eq(table.projectId, projectId))
      const [row] = await db_.delete(table).where(filter).returning()
      if (!row) return new Response('Not found', { status: 404 })
      return new Response(null, { status: 204 })
    },
  }
}
 
