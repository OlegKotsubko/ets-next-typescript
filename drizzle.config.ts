import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit does not auto-load env files; load them explicitly (.env.local wins over .env).
config({ path: ['.env.local', '.env'] })

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
