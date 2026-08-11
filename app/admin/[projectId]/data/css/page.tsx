'use client'
import { use, useEffect, useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useGetCssQuery, useUpdateCssMutation } from '@/store/apis/projectCssApi'

export default function ProjectCssPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data } = useGetCssQuery(projectId)
  const [updateCss, { isLoading }] = useUpdateCssMutation()
  const [css, setCss] = useState('')

  useEffect(() => {
    if (data) setCss(data.css)
  }, [data])

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Project CSS</Typography>
      <TextField
        multiline
        minRows={16}
        fullWidth
        value={css}
        onChange={(e) => setCss(e.target.value)}
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
