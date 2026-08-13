'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardActionArea, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
  IconButton, Menu, MenuItem,
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

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [updateRundown, { isLoading: isRenaming }] = useUpdateRundownMutation()
  const [deleteRundown, { isLoading: isDeleting }] = useDeleteRundownMutation()

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuTarget, setMenuTarget] = useState<Rundown | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Rundown | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  function openMenu(e: React.MouseEvent<HTMLElement>, rundown: Rundown) {
    e.preventDefault()
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
    setMenuTarget(rundown)
  }

  function closeMenu() {
    setMenuAnchor(null)
    setMenuTarget(null)
  }

  function openRenameDialog() {
    if (!menuTarget) return
    setRenameId(menuTarget.id)
    setRenameName(menuTarget.name)
    setRenameError(null)
    setRenameOpen(true)
    closeMenu()
  }

  function closeRenameDialog() {
    setRenameOpen(false)
    setRenameError(null)
  }

  async function handleRename() {
    if (!renameId) return
    setRenameError(null)
    try {
      await updateRundown({ projectId, id: renameId, data: { name: renameName } }).unwrap()
      setRenameOpen(false)
    } catch (err) {
      setRenameError(getErrorMessage(err, 'Failed to rename rundown. Please try again.'))
    }
  }

  function openDeleteDialog() {
    if (!menuTarget) return
    setDeleteTarget(menuTarget)
    setDeleteError(null)
    setDeleteOpen(true)
    closeMenu()
  }

  function closeDeleteDialog() {
    setDeleteOpen(false)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      await deleteRundown({ projectId, id: deleteTarget.id }).unwrap()
      setDeleteOpen(false)
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete rundown. Please try again.'))
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
            <Card sx={{ position: 'relative' }}>
              <IconButton size="small"
                onClick={(e) => openMenu(e, r)}
                sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
                aria-label="Rundown actions">
                <MoreVertIcon fontSize="small" />
              </IconButton>
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

      <Menu anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}>
        <MenuItem onClick={openRenameDialog}>
          Rename
        </MenuItem>
        <MenuItem onClick={openDeleteDialog}>
          Delete
        </MenuItem>
      </Menu>

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

      <Dialog open={renameOpen}
        onClose={closeRenameDialog}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          Rename Rundown
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {renameError && <Alert severity="error">
            {renameError}
          </Alert>}
          <TextField label="Name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            required />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRenameDialog}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={handleRename}
            disabled={!renameName.trim() || isRenaming}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen}
        onClose={closeDeleteDialog}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          Delete Rundown
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {deleteError && <Alert severity="error">
            {deleteError}
          </Alert>}
          <Typography>
            Delete &ldquo;
            {deleteTarget?.name}
            &rdquo;? This can&apos;t be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>
            Cancel
          </Button>
          <Button variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={isDeleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
