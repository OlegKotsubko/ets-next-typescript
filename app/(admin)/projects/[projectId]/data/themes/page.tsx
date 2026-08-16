'use client'
import { use, useState } from 'react'
import {
  Box, Button, Typography, List, ListItem, ListItemText, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  useListThemesQuery, useCreateThemeMutation, useUpdateThemeMutation, useDeleteThemeMutation,
} from '@/store/apis/themesApi'
import type { Theme, ThemeColor } from '@/lib/entities/themes'

export default function ThemesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: themes = [] } = useListThemesQuery(projectId)
  const [createTheme] = useCreateThemeMutation()
  const [updateTheme] = useUpdateThemeMutation()
  const [deleteTheme] = useDeleteThemeMutation()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [colors, setColors] = useState<ThemeColor[]>([])

  function setColor(i: number, patch: Partial<ThemeColor>) {
    setColors((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  async function add() {
    if (!name.trim()) return
    await createTheme({ projectId, data: { name: name.trim(), colors: colors.filter((c) => c.name && c.code) } })
    setName('')
    setColors([])
    setOpen(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">
          Themes
        </Typography>
        <Button variant="contained"
          onClick={() => setOpen(true)}>
          Add Theme
        </Button>
      </Box>
      <List>
        {themes.map((t: Theme) => (
          <ListItem key={t.id}
            secondaryAction={(
              <IconButton aria-label="Delete"
                onClick={() => deleteTheme({ projectId, id: t.id })}>
                <DeleteIcon />
              </IconButton>
            )}>
            <ListItemText primary={t.name}
              secondary={`${t.colors.length} colors`} />
            {t.isActive
              ? <Chip label="Active"
                color="success"
                size="small"
                sx={{ mr: 6 }} />
              : (
                <Button size="small"
                  sx={{ mr: 6 }}
                  onClick={() => updateTheme({ projectId, id: t.id, data: { isActive: true } })}>
                  Activate
                </Button>
              )}
          </ListItem>
        ))}
      </List>

      <Dialog open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          Add Theme
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)} />
          <Typography variant="caption"
            color="text.secondary">
            Colors (name → CSS var, code)
          </Typography>
          {colors.map((c, i) => (
            <Stack key={i}
              direction="row"
              spacing={1}>
              <TextField size="small"
                label="Name"
                value={c.name}
                onChange={(e) => setColor(i, { name: e.target.value })} />
              <TextField size="small"
                label="Code"
                value={c.code}
                onChange={(e) => setColor(i, { code: e.target.value })} />
            </Stack>
          ))}
          <Button size="small"
            onClick={() => setColors((prev) => [...prev, { name: '', code: '' }])}>
            Add color
          </Button>
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
