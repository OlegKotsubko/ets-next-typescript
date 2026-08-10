import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Box, Typography } from '@mui/material'
import { auth } from '@/lib/auth'
import SignOutButton from './SignOutButton'

// proxy.ts only checks cookie presence; this is the authoritative check.
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <Box sx={{ p: 4 }}>
      <Typography
        variant="h4"
        gutterBottom
      >
        Admin
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Signed in as
        {' '}
        {session.user.email}
      </Typography>
      <SignOutButton />
    </Box>
  )
}
