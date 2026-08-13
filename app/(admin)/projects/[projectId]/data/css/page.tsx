'use client'
import { use, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useGetCssQuery, useUpdateCssMutation } from '@/store/apis/projectCssApi'

export default function ProjectCssPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data } = useGetCssQuery(projectId)
  const [updateCss, { isLoading }] = useUpdateCssMutation()
  // Local edits (once the operator starts typing) win over the fetched value —
  // avoids syncing query data into state via an effect.
  const [localCss, setLocalCss] = useState<string | null>(null)
  const css = localCss ?? data?.css ?? ''

  return (
    <Box>
      <Typography variant="h5"
        sx={{ mb: 2 }}>
Project CSS
      </Typography>
      <TextField
        multiline
        minRows={16}
        fullWidth
        value={css}
        onChange={(e) => setLocalCss(e.target.value)}
        sx={{ fontFamily: 'monospace' }}
      />
      <Button
        variant="contained"
        sx={{ mt: 2 }}
        disabled={isLoading}
        onClick={() => updateCss({ projectId, css })}
      >
        Save
      </Button>
    </Box>
  )
}
