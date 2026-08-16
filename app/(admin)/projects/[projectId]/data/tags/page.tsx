'use client'
import { useState } from 'react'
import {
  Box, Button, Typography, List, ListItem, ListItemText, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  useListTagsQuery, useCreateTagMutation, useDeleteTagMutation,
} from '@/store/apis/tagsApi'
import type { Tag } from '@/lib/entities/tags'

// Tags are global; this page manages the shared vocabulary from within the
// workspace for convenience (it ignores [projectId]).
export default function TagsPage() {
  const { data: tags = [] } = useListTagsQuery()
  const [createTag] = useCreateTagMutation()
  const [deleteTag] = useDeleteTagMutation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  async function add() {
    if (!name.trim()) return
    await createTag({ name: name.trim() })
    setName('')
    setOpen(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">
          Disciplines / Tags
        </Typography>
        <Button variant="contained"
          onClick={() => setOpen(true)}>
          Add Tag
        </Button>
      </Box>
      <List>
        {tags.map((t: Tag) => (
          <ListItem key={t.id}
            secondaryAction={(
              <IconButton aria-label="Delete"
                onClick={() => deleteTag(t.id)}>
                <DeleteIcon />
              </IconButton>
            )}>
            <ListItemText primary={t.name} />
          </ListItem>
        ))}
      </List>
      <Dialog open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          Add Tag
        </DialogTitle>
        <DialogContent>
          <TextField autoFocus
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={add}
            disabled={!name.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
