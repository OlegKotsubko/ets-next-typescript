'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box, Typography, Button, Card, CardContent, IconButton, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControlLabel, Checkbox, List, ListItem, ListItemText,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { listOverlays } from '@/lib/overlays/catalog'
import { useGetProjectQuery } from '@/store/apis/projectsApi'
import { useListTagsQuery } from '@/store/apis/tagsApi'
import { useGetRundownQuery } from '@/store/apis/rundownsApi'
import {
  useListRundownOverlaysQuery, useCreateRundownOverlayMutation, useUpdateRundownOverlayMutation,
  useDeleteRundownOverlayMutation, useReorderRundownOverlaysMutation, type RundownOverlay,
} from '@/store/apis/rundownOverlaysApi'
import { OverlayWidgetForm } from '@/components/admin/overlays/OverlayWidgetForm'

const RANGE_1_7 = [1, 2, 3, 4, 5, 6, 7]
const DISPLAY_FILTERS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

export default function RundownEditorPage({ params }: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: project } = useGetProjectQuery(projectId)
  const { data: tags = [] } = useListTagsQuery()
  const { data: rundown } = useGetRundownQuery({ projectId, id: Number(rundownId) })
  const { data: overlays = [] } = useListRundownOverlaysQuery({ projectId, rundownId })
  const [createOverlay] = useCreateRundownOverlayMutation()
  const [updateOverlay] = useUpdateRundownOverlayMutation()
  const [deleteOverlay] = useDeleteRundownOverlayMutation()
  const [reorderOverlays] = useReorderRundownOverlaysMutation()

  const disciplineName = tags.find((t) => t.id === project?.disciplineId)?.name
  const catalog = listOverlays(disciplineName)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState<RundownOverlay | null>(null)

  async function add(model: string) {
    await createOverlay({ projectId, rundownId, data: { model } })
    setPickerOpen(false)
  }
  async function move(index: number, dir: -1 | 1) {
    const ids = overlays.map((o) => o.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const swapped = [ids[j], ids[index]]
    ids[index] = swapped[0]
    ids[j] = swapped[1]
    await reorderOverlays({ projectId, rundownId, orderedIds: ids })
  }
  async function saveSettings(o: RundownOverlay, patch: Partial<RundownOverlay>) {
    await updateOverlay({ projectId, rundownId, overlayId: o.id, data: patch as Record<string, unknown> })
    setEditing((cur) => (cur && cur.id === o.id ? { ...cur, ...patch } : cur))
  }
  async function saveWidget(o: RundownOverlay, widget: Record<string, unknown>) {
    await updateOverlay({ projectId, rundownId, overlayId: o.id, data: { widget } })
  }

  return (
    <Box sx={{ p: 4 }}>
      <Button component={Link}
        href={`/projects/${projectId}/rundowns`}
        size="small"
        sx={{ mb: 1 }}>
        ← Rundowns
      </Button>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {rundown?.name ?? 'Rundown'}
        </Typography>
        <Button variant="contained"
          onClick={() => setPickerOpen(true)}>
          Add Overlay
        </Button>
      </Box>

      {overlays.length === 0 && (
        <Typography color="text.secondary">
          No overlays yet — click Add Overlay.
        </Typography>
      )}

      {overlays.map((o, i) => (
        <Card key={o.id}
          sx={{ mb: 1 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip size="small"
              label={`L${o.layer}`} />
            <Chip size="small"
              label={`C${o.color}`} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1">
                {o.widgetName}
              </Typography>
              <Typography variant="caption"
                color="text.secondary">
                {o.model}
                {o.isFullscreen ? ' · full-screen' : ''}
                {o.displayFilter ? ` · display ${o.displayFilter}` : ''}
              </Typography>
            </Box>
            <IconButton size="small"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => move(i, -1)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
              aria-label="Move down"
              disabled={i === overlays.length - 1}
              onClick={() => move(i, 1)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
              aria-label="Edit"
              onClick={() => setEditing(o)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
              aria-label="Delete"
              color="error"
              onClick={() => deleteOverlay({ projectId, rundownId, overlayId: o.id })}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </CardContent>
        </Card>
      ))}

      {/* Overlay picker */}
      <Dialog open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        fullWidth
        maxWidth="md">
        <DialogTitle>
          Add Overlay
        </DialogTitle>
        <DialogContent>
          <Grid container
            spacing={2}
            sx={{ mt: 0 }}>
            {catalog.map((e) => (
              <Grid key={e.model}
                size={{ xs: 12, sm: 6, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1">
                      {e.widgetName}
                    </Typography>
                    <Typography variant="caption"
                      color="text.secondary">
                      {e.category}
                      {e.isFullscreen ? ' · full-screen' : ''}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Button size="small"
                        variant="contained"
                        onClick={() => add(e.model)}>
                        Add
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Overlay editor */}
      <Dialog open={Boolean(editing)}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm">
        {editing && (
          <>
            <DialogTitle>
              {editing.widgetName}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField label="Name"
                  value={editing.widgetName}
                  onChange={(e) => setEditing({ ...editing, widgetName: e.target.value })} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField select
                    label="Layer"
                    value={editing.layer}
                    onChange={(e) => setEditing({ ...editing, layer: Number(e.target.value) })}
                    sx={{ flex: 1 }}>
                    {RANGE_1_7.map((n) => <MenuItem key={n}
                      value={n}>
                      {n}
                    </MenuItem>)}
                  </TextField>
                  <TextField select
                    label="Color"
                    value={editing.color}
                    onChange={(e) => setEditing({ ...editing, color: Number(e.target.value) })}
                    sx={{ flex: 1 }}>
                    {RANGE_1_7.map((n) => <MenuItem key={n}
                      value={n}>
                      {n}
                    </MenuItem>)}
                  </TextField>
                  <TextField select
                    label="Display"
                    value={editing.displayFilter ?? ''}
                    onChange={(e) => setEditing({ ...editing, displayFilter: e.target.value })}
                    sx={{ flex: 1 }}>
                    {DISPLAY_FILTERS.map((v) => <MenuItem key={v || 'all'}
                      value={v}>
                      {v || 'all'}
                    </MenuItem>)}
                  </TextField>
                </Box>
                <FormControlLabel label="Full-screen"
                  control={<Checkbox checked={editing.isFullscreen}
                    onChange={(e) => setEditing({ ...editing, isFullscreen: e.target.checked })} />} />
                <Button variant="contained"
                  onClick={() => saveSettings(editing, {
                    widgetName: editing.widgetName, layer: editing.layer, color: editing.color,
                    displayFilter: editing.displayFilter, isFullscreen: editing.isFullscreen,
                  })}>
                  Save settings
                </Button>
                <Divider />
                <Typography variant="subtitle2">
                  Fields
                </Typography>
                <OverlayWidgetForm model={editing.model}
                  value={editing.data.widget}
                  onSubmit={(w) => saveWidget(editing, w)} />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditing(null)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
