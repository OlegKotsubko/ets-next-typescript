'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardActionArea, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import { useListRundownsQuery, useCreateRundownMutation } from '@/store/apis/rundownsApi'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'
import type { Rundown } from '@/lib/entities/rundowns'

export default function RundownsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: rundowns = [], isError } = useListRundownsQuery(projectId)
  const [createRundown, { isLoading }] = useCreateRundownMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  function closeDialog() {
    setOpen(false)
    setCreateError(null)
  }

  async function handleCreate() {
    setCreateError(null)
    try {
      await createRundown({ projectId, data: { name } }).unwrap()
      setName('')
      setOpen(false)
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Failed to create rundown. Please try again.'))
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Rundowns
        </Typography>
      </Box>

      <Button variant="contained"
        onClick={() => setOpen(true)}
        sx={{ mb: 3 }}>
        Add Rundown
      </Button>

      {isError && (
        <Alert severity="error"
          sx={{ mb: 2 }}>
          Failed to load rundowns — please refresh.
        </Alert>
      )}

      {!isError && rundowns.length === 0 && (
        <Typography color="text.secondary">
          No rundowns yet — click Add Rundown to create one.
        </Typography>
      )}

      <Grid container
        spacing={2}>
        {rundowns.map((r: Rundown) => (
          <Grid key={r.id}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea component={Link}
                href={`/admin/${projectId}/rundowns/${r.id}`}>
                <CardContent>
                  <Typography variant="h6">
                    {r.name}
                  </Typography>
                  <Typography variant="body2"
                    color="text.secondary">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          Add Rundown
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {createError && <Alert severity="error">
            {createError}
          </Alert>}
          <TextField label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || isLoading}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
