import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit does not auto-load .env.local; load it explicitly.
config({ path: '.env.local' })

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
