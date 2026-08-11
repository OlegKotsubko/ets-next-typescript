'use client'

import { Button } from '@mui/material'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'

export default function SignOutButton() {
  const router = useRouter()
  return (
    <Button
      variant="outlined"
      onClick={() => signOut().then(() => router.push('/login'))}
    >
      Sign out
    </Button>
  )
}
