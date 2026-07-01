// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
const hasDb = Boolean(process.env.DATABASE_URL)

// Requires a migrated + seeded Neon branch. Skipped when DATABASE_URL is unset.
describe.skipIf(!hasDb)('db round-trip', () => {
  it('inserts and reads back a rundown under the seed project', async () => {
    const { db } = await import('@/db')
    const { rundowns } = await import('@/db/schema')
    const { SEED_PROJECT_ID } = await import('@/db/constants')
    const { eq } = await import('drizzle-orm')

    const [row] = await db
      .insert(rundowns)
      .values({ projectId: SEED_PROJECT_ID, name: 'Round-trip test' })
      .returning()
    expect(row.id).toBeDefined()

    const found = await db.select().from(rundowns).where(eq(rundowns.id, row.id))
    expect(found[0]?.name).toBe('Round-trip test')

    await db.delete(rundowns).where(eq(rundowns.id, row.id))
  })
})
