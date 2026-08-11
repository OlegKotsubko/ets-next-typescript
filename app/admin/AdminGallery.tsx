'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardActionArea, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import { useListProjectsQuery, useCreateProjectMutation } from '@/store/apis/projectsApi'
import { useListOverlayPackagesQuery } from '@/store/apis/overlayPackagesApi'
import SignOutButton from './SignOutButton'

export default function AdminGallery({ userEmail }: { userEmail: string }) {
  const { data: projects = [] } = useListProjectsQuery()
  const { data: packages = [] } = useListOverlayPackagesQuery()
  const [createProject] = useCreateProjectMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'team_vs_team' | 'player_vs_player'>('team_vs_team')
  const [label, setLabel] = useState('')
  const [eventDate, setEventDate] = useState('')

  function resetForm() {
    setName('')
    setMode('team_vs_team')
    setLabel('')
    setEventDate('')
  }

  async function handleCreate() {
    await createProject({
      name,
      mode,
      label,
      ...(eventDate ? { eventDate } : {}),
    })
    resetForm()
    setOpen(false)
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
Projects
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2">
            {userEmail}
          </Typography>
          <SignOutButton />
        </Box>
      </Box>

      <Button variant="contained"
        onClick={() => setOpen(true)}
        sx={{ mb: 3 }}>
        Add Project
      </Button>

      {projects.length === 0 && (
        <Typography color="text.secondary">
No projects yet — click Add Project to create one.
        </Typography>
      )}

      <Grid container
        spacing={2}>
        {projects.map((p) => (
          <Grid key={p.id}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea component={Link}
                href={`/admin/${p.id}/data`}>
                <CardContent>
                  <Typography variant="h6">
                    {p.name}
                  </Typography>
                  <Typography variant="body2"
                    color="text.secondary">
                    {p.mode}
                  </Typography>
                  <Typography variant="body2"
                    color="text.secondary">
                    {p.label}
                  </Typography>
                  {p.eventDate && <Typography variant="body2"
                    color="text.secondary">
                    {p.eventDate}
                  </Typography>}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
Add Project
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required />
          <TextField
            select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'team_vs_team' | 'player_vs_player')}
          >
            <MenuItem value="team_vs_team">
Team vs Team
            </MenuItem>
            <MenuItem value="player_vs_player">
Player vs Player
            </MenuItem>
          </TextField>
          <TextField
            select
            label="Overlay Package"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          >
            {packages.map((pkg) => (
              <MenuItem key={pkg.label}
                value={pkg.label}>
                {pkg.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Event Date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
Cancel
          </Button>
          <Button variant="contained"
            onClick={handleCreate}
            disabled={!name || !label}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
