'use client'
import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Box, Typography, CircularProgress, IconButton, Stack, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useGetRundownQuery, useUpdateRundownMutation, useDeleteRundownMutation } from '@/store/apis/rundownsApi'
import {
  useListItemsQuery, useCreateItemMutation, useUpdateItemMutation,
  useDeleteItemMutation, useReorderItemsMutation,
} from '@/store/apis/rundownItemsApi'
import { useListTitlesQuery } from '@/store/apis/titlesApi'
import { AddTemplateModal } from '@/components/admin/rundown/AddTemplateModal'
import { RundownItemRow } from '@/components/admin/rundown/RundownItemRow'
import type { CreateRundownItemInput } from '@/db/schemas/rundown-items'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'

type FieldErrors = { fieldErrors?: Record<string, string[]> }

export default function RundownPage({
  params,
}: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const router = useRouter()
  const { data: rundown, isLoading, isError } = useGetRundownQuery({ projectId, id: rundownId })
  const [updateRundown, { isLoading: isRenaming }] = useUpdateRundownMutation()
  const [deleteRundown, { isLoading: isDeleting }] = useDeleteRundownMutation()

  const { data: items = [] } = useListItemsQuery({ projectId, rundownId })
  const { data: titles = [] } = useListTitlesQuery({ projectId })
  const [createItem] = useCreateItemMutation()
  const [updateItem, { isLoading: isSaving }] = useUpdateItemMutation()
  const [deleteItem] = useDeleteItemMutation()
  const [reorderItems] = useReorderItemsMutation()

  const optionByKey = useMemo(() => Object.fromEntries(titles.map((t) => [t.key, t])), [titles])

  const [addOpen, setAddOpen] = useState(false)

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

  async function handleDeleteRundown() {
    setDeleteError(null)
    try {
      await deleteRundown({ projectId, id: rundownId }).unwrap()
      router.push(`/projects/${projectId}/rundowns`)
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete rundown. Please try again.'))
    }
  }

  function handleCreate(payload: CreateRundownItemInput) {
    return createItem({ projectId, rundownId, data: payload }).unwrap()
  }

  function move(index: number, dir: -1 | 1) {
    const ids = items.map((it) => it.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const swapped = [...ids]
    ;[swapped[index], swapped[j]] = [swapped[j], swapped[index]]
    reorderItems({ projectId, rundownId, orderedIds: swapped })
  }

  async function saveItemData(itemId: string, values: Record<string, unknown>): Promise<FieldErrors | void> {
    try {
      await updateItem({ projectId, rundownId, itemId, data: { data: values } }).unwrap()
    } catch (err) {
      const data = (err as { data?: unknown })?.data
      if (data && typeof data === 'object' && 'fieldErrors' in data) {
        return { fieldErrors: (data as FieldErrors).fieldErrors }
      }
      return { fieldErrors: {} }
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Link href={`/projects/${projectId}/rundowns`}>
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

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Typography color="text.secondary">
              {items.length}
              {items.length === 1 ? ' item' : ' items'}
            </Typography>
            <Button variant="contained"
              onClick={() => setAddOpen(true)}>
              Add Template
            </Button>
          </Box>

          <Stack spacing={1}
            sx={{ mt: 2 }}>
            {items.map((item, i) => (
              <RundownItemRow
                key={item.id}
                item={item}
                option={optionByKey[item.titleKey]}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                onReorderUp={() => move(i, -1)}
                onReorderDown={() => move(i, 1)}
                onDelete={() => deleteItem({ projectId, rundownId, itemId: item.id })}
                onSaveData={(values) => saveItemData(item.id, values)}
                saving={isSaving}
              />
            ))}
          </Stack>
        </Box>
      )}

      <AddTemplateModal open={addOpen}
        options={titles}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate} />

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
            onClick={handleDeleteRundown}
            disabled={isDeleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
