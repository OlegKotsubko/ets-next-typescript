'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Card, CardActionArea, CardContent, CardMedia,
  IconButton, Chip, ToggleButtonGroup, ToggleButton, Alert,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import {
  useListProjectsQuery, useSetFavouriteMutation, useUnsetFavouriteMutation,
  type Project,
} from '@/store/apis/projectsApi'
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

  function toggleFavourite(p: Project) {
    if (p.isFavourite) unsetFavourite({ projectId: p.id })
    else setFavourite({ projectId: p.id })
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Tournaments
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                {p.heroSectionUrl && (
                  <CardMedia component="img"
                    height="140"
                    image={p.heroSectionUrl}
                    alt="" />
                )}
                <CardContent>
                  <Typography variant="h6">
                    {p.title}
                  </Typography>
                  <Chip size="small"
                    label={p.status}
                    sx={{ mt: 1, textTransform: 'capitalize' }} />
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
