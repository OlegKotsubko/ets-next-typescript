import { config } from 'dotenv'

// Load env before importing @/db (db/index.ts reads DATABASE_URL at module load).
config({ path: ['.env.local', '.env'] })

// Dev seed: a handful of global tags (disciplines) + tournaments spanning the
// status filter. Re-running inserts fresh rows (dev only) — clear the tables
// first if you don't want duplicates.
async function main() {
  const { db } = await import('../db')
  const { tags, projects } = await import('../db/schema')

  const tagRows = await db.insert(tags).values([
    { name: 'Dota 2' },
    { name: 'CS2' },
    { name: 'Valorant' },
    { name: 'League of Legends' },
  ]).returning()
  const byName = Object.fromEntries(tagRows.map((t) => [t.name, t.id]))
  console.log(`Inserted ${tagRows.length} tags: ${tagRows.map((t) => t.name).join(', ')}`)

  const projectRows = await db.insert(projects).values([
    { title: 'Spring Major 2026', status: 'ongoing', disciplineId: byName['Dota 2'] },
    { title: 'Summer Open Qualifier', status: 'upcoming', disciplineId: byName['CS2'] },
    { title: 'Autumn Invitational', status: 'draft', disciplineId: byName['Valorant'] },
    { title: 'Winter Championship 2025', status: 'ended', disciplineId: byName['League of Legends'] },
  ]).returning()
  console.log(`Inserted ${projectRows.length} projects:`)
  for (const p of projectRows) console.log(`  #${p.id} ${p.title} [${p.status}]`)
}

void main().then(() => process.exit(0)).catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
