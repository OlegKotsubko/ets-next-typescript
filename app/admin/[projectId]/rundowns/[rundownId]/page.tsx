'use client'
import { use } from 'react'
import Link from 'next/link'
import { Box, Typography, CircularProgress } from '@mui/material'
import { useGetRundownQuery } from '@/store/apis/rundownsApi'

export default function RundownStubPage({
  params,
}: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: rundown, isLoading, isError } = useGetRundownQuery({ projectId, id: rundownId })

  return (
    <Box sx={{ p: 4 }}>
      <Link href={`/admin/${projectId}/rundowns`}>
        ← Back to Rundowns
      </Link>

      {isLoading && (
        <Box sx={{ mt: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {isError && (
        <Typography sx={{ mt: 3 }}
          color="error">
          Rundown not found.
        </Typography>
      )}

      {rundown && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4"
            gutterBottom>
            {rundown.name}
          </Typography>
          <Typography color="text.secondary">
0 items
          </Typography>
        </Box>
      )}
    </Box>
  )
}
