// Bootstrap an operator account. No public sign-up exists (disableSignUp on the
// app instance), so this script builds its own sign-up-enabled instance.
// Usage: npx tsx scripts/create-user.ts <email> <password>
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const [, , email, password] = process.argv
if (!email || !password) {
  console.error('Usage: npx tsx scripts/create-user.ts <email> <password>')
  process.exit(1)
}

// Wrapped in main() rather than top-level await: the repo has no "type":"module",
// so tsx transpiles this to CJS, where top-level await is unavailable.
async function main() {
  // Dynamic imports so dotenv runs before @/lib/auth reads process.env.
  const { betterAuth } = await import('better-auth')
  const { buildAuthOptions } = await import('../lib/auth')

  const auth = betterAuth(buildAuthOptions({ allowSignUp: true }))

  try {
    await auth.api.signUpEmail({ body: { email, password, name: email } })
    console.log(`Created ${email}`)
  } catch (err) {
    console.error(`Failed to create ${email}:`, err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

void main()
