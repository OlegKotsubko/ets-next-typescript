'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Box, Typography, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Button,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useGetRundownQuery, useUpdateRundownMutation, useDeleteRundownMutation } from '@/store/apis/rundownsApi'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'

export default function RundownStubPage({
  params,
}: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const router = useRouter()
  const { data: rundown, isLoading, isError } = useGetRundownQuery({ projectId, id: rundownId })
  const [updateRundown, { isLoading: isRenaming }] = useUpdateRundownMutation()
  const [deleteRundown, { isLoading: isDeleting }] = useDeleteRundownMutation()

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openRenameDialog() {
    if (!rundown) return
    setRenameName(rundown.name)
    setRenameError(null)
    setRenameOpen(true)
  }

  function closeRenameDialog() {
    setRenameOpen(false)
    setRenameError(null)
  }

  async function handleRename() {
    setRenameError(null)
    try {
      await updateRundown({ projectId, id: rundownId, data: { name: renameName } }).unwrap()
      setRenameOpen(false)
    } catch (err) {
      setRenameError(getErrorMessage(err, 'Failed to rename rundown. Please try again.'))
    }
  }

  function closeDeleteDialog() {
    setDeleteOpen(false)
    setDeleteError(null)
  }

  async function handleDelete() {
    setDeleteError(null)
    try {
      await deleteRundown({ projectId, id: rundownId }).unwrap()
      router.push(`/admin/${projectId}/rundowns`)
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete rundown. Please try again.'))
    }
  }

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4">
              {rundown.name}
            </Typography>
            <IconButton size="small"
              onClick={openRenameDialog}
              aria-label="Rename rundown">
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete rundown">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography color="text.secondary"
            sx={{ mt: 1 }}>
0 items
          </Typography>
        </Box>
      )}

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
            {rundown?.name}
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
