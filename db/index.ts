import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// The HTTP driver opens a fresh connection per query — safe in serverless.
const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
