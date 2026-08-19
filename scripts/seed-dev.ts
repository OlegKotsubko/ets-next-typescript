import { config } from 'dotenv'

// Load env before importing @/db (db/index.ts reads DATABASE_URL at module load).
config({ path: ['.env.local', '.env'] })

// Dev seed: a handful of tournaments spanning the status filter, each referencing
// the `general` overlay pack. Re-running inserts fresh rows (dev only) — clear the
// table first if you don't want duplicates.
async function main() {
  const { db } = await import('../db')
  const { projects } = await import('../db/schema')

  const projectRows = await db.insert(projects).values([
    { title: 'Spring Major 2026', status: 'ongoing', overlayPacks: ['general'] },
    { title: 'Summer Open Qualifier', status: 'upcoming', overlayPacks: ['general'] },
    { title: 'Autumn Invitational', status: 'draft', overlayPacks: ['general'] },
    { title: 'Winter Championship 2025', status: 'ended', overlayPacks: ['general'] },
  ]).returning()
  console.log(`Inserted ${projectRows.length} projects:`)
  for (const p of projectRows) console.log(`  #${p.id} ${p.title} [${p.status}]`)
}

void main().then(() => process.exit(0)).catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
