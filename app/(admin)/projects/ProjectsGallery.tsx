'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Card, CardActionArea, CardContent,
  IconButton, Chip, ToggleButtonGroup, ToggleButton, Alert, Button,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import {
  useListProjectsQuery, useSetFavouriteMutation, useUnsetFavouriteMutation,
  useCreateProjectMutation, useUpdateProjectMutation, useDeleteProjectMutation,
  type Project,
} from '@/store/apis/projectsApi'
import { TournamentFormDialog, type TournamentFormValues } from '@/components/admin/projects/TournamentFormDialog'
import SignOutButton from './SignOutButton'

const STATUSES = ['all', 'draft', 'upcoming', 'ongoing', 'ended'] as const
type StatusFilter = (typeof STATUSES)[number]

export default function ProjectsGallery({ userEmail }: { userEmail: string }) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const { data: projects = [], isError } = useListProjectsQuery(
    status === 'all' ? undefined : { status },
  )
  const [setFavourite] = useSetFavouriteMutation()
  const [unsetFavourite] = useUnsetFavouriteMutation()
  const [createProject] = useCreateProjectMutation()
  const [updateProject] = useUpdateProjectMutation()
  const [deleteProject] = useDeleteProjectMutation()

  // null = closed; { } = create; { id, … } = edit
  const [editing, setEditing] = useState<{ id?: number; initial?: TournamentFormValues } | null>(null)

  function toggleFavourite(p: Project) {
    if (p.isFavourite) unsetFavourite({ projectId: p.id })
    else setFavourite({ projectId: p.id })
  }

  async function submitForm(data: TournamentFormValues) {
    if (editing?.id != null) await updateProject({ projectId: editing.id, data })
    else await createProject(data)
    setEditing(null)
  }

  function removeProject(p: Project) {
    // eslint-disable-next-line no-alert
    if (window.confirm(`Delete tournament "${p.title}"? This removes its rundowns and data.`)) {
      deleteProject({ projectId: p.id })
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Tournaments
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setEditing({})}>
            Add tournament
          </Button>
          <Typography variant="body2">
            {userEmail}
          </Typography>
          <SignOutButton />
        </Box>
      </Box>

      <ToggleButtonGroup value={status}
        exclusive
        size="small"
        onChange={(_e, v) => v && setStatus(v)}
        sx={{ mb: 3 }}>
        {STATUSES.map((s) => (
          <ToggleButton key={s}
            value={s}
            sx={{ textTransform: 'capitalize' }}>
            {s}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {isError && (
        <Alert severity="error"
          sx={{ mb: 2 }}>
          Failed to load tournaments — please refresh.
        </Alert>
      )}

      {!isError && projects.length === 0 && (
        <Typography color="text.secondary">
          No tournaments match this filter.
        </Typography>
      )}

      <Grid container
        spacing={2}>
        {projects.map((p) => (
          <Grid key={p.id}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ position: 'relative' }}>
              <IconButton aria-label={p.isFavourite ? 'Unfavourite' : 'Favourite'}
                onClick={() => toggleFavourite(p)}
                sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, color: 'warning.main' }}>
                {p.isFavourite ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
              <CardActionArea component={Link}
                href={`/projects/${p.id}/data`}>
                <CardContent>
                  <Typography variant="h6">
                    {p.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                    <Chip size="small"
                      label={p.status}
                      sx={{ textTransform: 'capitalize' }} />
                    {p.overlayPacks.map((pack) => (
                      <Chip key={pack}
                        size="small"
                        variant="outlined"
                        label={pack} />
                    ))}
                  </Box>
                </CardContent>
              </CardActionArea>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pb: 1 }}>
                <IconButton size="small"
                  aria-label="Edit"
                  onClick={() => setEditing({ id: p.id, initial: { title: p.title, status: p.status, overlayPacks: p.overlayPacks } })}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small"
                  aria-label="Delete"
                  color="error"
                  onClick={() => removeProject(p)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {editing && (
        <TournamentFormDialog open
          initial={editing.initial}
          onClose={() => setEditing(null)}
          onSubmit={submitForm} />
      )}
    </Box>
  )
}
