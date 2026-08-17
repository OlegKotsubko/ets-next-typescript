'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardActionArea, CardContent, IconButton, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  useListRundownsQuery, useCreateRundownMutation,
  useUpdateRundownMutation, useDeleteRundownMutation,
} from '@/store/apis/rundownsApi'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'
import type { Rundown } from '@/lib/entities/rundowns'

export default function RundownsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: rundowns = [], isError } = useListRundownsQuery(projectId)
  const [createRundown, { isLoading }] = useCreateRundownMutation()
  const [updateRundown, { isLoading: isRenaming }] = useUpdateRundownMutation()
  const [deleteRundown] = useDeleteRundownMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuTarget, setMenuTarget] = useState<Rundown | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameName, setRenameName] = useState('')

  async function handleCreate() {
    setCreateError(null)
    try {
      await createRundown({ projectId, data: { name } }).unwrap()
      setName('')
      setOpen(false)
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Failed to create rundown.'))
    }
  }

  function openMenu(e: React.MouseEvent<HTMLElement>, rundown: Rundown) {
    setMenuAnchor(e.currentTarget)
    setMenuTarget(rundown)
  }
  function closeMenu() {
    setMenuAnchor(null)
    setMenuTarget(null)
  }
  function openRename() {
    if (!menuTarget) return
    setRenameId(menuTarget.id)
    setRenameName(menuTarget.name)
    setRenameOpen(true)
    closeMenu()
  }
  async function handleRename() {
    if (renameId == null) return
    await updateRundown({ projectId, id: renameId, data: { name: renameName } })
    setRenameOpen(false)
  }
  async function handleDelete() {
    if (!menuTarget) return
    await deleteRundown({ projectId, id: menuTarget.id })
    closeMenu()
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4"
        sx={{ mb: 3 }}>
        Rundowns
      </Typography>

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
          No rundowns yet.
        </Typography>
      )}

      <Grid container
        spacing={2}>
        {rundowns.map((r: Rundown) => (
          <Grid key={r.id}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ position: 'relative' }}>
              <IconButton size="small"
                aria-label="Rundown actions"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMenu(e, r) }}
                sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <CardActionArea component={Link}
                href={`/projects/${projectId}/rundowns/${r.id}`}>
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

      <Menu anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}>
        <MenuItem onClick={openRename}>
          Rename
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={open}
        onClose={() => setOpen(false)}
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
          <Button onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || isLoading}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen}
        onClose={() => setRenameOpen(false)}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          Rename Rundown
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField label="Name"
            fullWidth
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={handleRename}
            disabled={!renameName.trim() || isRenaming}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
