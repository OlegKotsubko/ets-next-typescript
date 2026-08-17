'use client'
import { useState } from 'react'
import {
  Box, Button, Checkbox, Divider, FormControlLabel, MenuItem, TextField, Typography,
} from '@mui/material'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { OverlayWidgetForm } from './OverlayWidgetForm'

const RANGE_1_7 = [1, 2, 3, 4, 5, 6, 7]
const DISPLAY_FILTERS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

export function OverlayPropertiesForm({
  overlay, onSaveSettings, onSaveWidget, onDelete,
}: {
  overlay: RundownOverlay
  onSaveSettings: (patch: Partial<RundownOverlay>) => void
  onSaveWidget: (widget: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [widgetName, setWidgetName] = useState(overlay.widgetName)
  const [layer, setLayer] = useState(overlay.layer)
  const [color, setColor] = useState(overlay.color)
  const [displayFilter, setDisplayFilter] = useState(overlay.displayFilter ?? '')
  const [isFullscreen, setIsFullscreen] = useState(overlay.isFullscreen)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {overlay.widgetName}
        </Typography>
        <Button color="error"
          onClick={onDelete}>
          Delete
        </Button>
      </Box>
      <TextField label="Name"
        value={widgetName}
        onChange={(e) => setWidgetName(e.target.value)} />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField select
          label="Layer"
          value={layer}
          onChange={(e) => setLayer(Number(e.target.value))}
          sx={{ flex: 1 }}>
          {RANGE_1_7.map((n) => <MenuItem key={n}
            value={n}>
            {n}
          </MenuItem>)}
        </TextField>
        <TextField select
          label="Color"
          value={color}
          onChange={(e) => setColor(Number(e.target.value))}
          sx={{ flex: 1 }}>
          {RANGE_1_7.map((n) => <MenuItem key={n}
            value={n}>
            {n}
          </MenuItem>)}
        </TextField>
        <TextField select
          label="Display"
          value={displayFilter}
          onChange={(e) => setDisplayFilter(e.target.value)}
          sx={{ flex: 1 }}>
          {DISPLAY_FILTERS.map((v) => <MenuItem key={v || 'all'}
            value={v}>
            {v || 'all'}
          </MenuItem>)}
        </TextField>
      </Box>
      <FormControlLabel label="Full-screen"
        control={<Checkbox checked={isFullscreen}
          onChange={(e) => setIsFullscreen(e.target.checked)} />} />
      <Button variant="contained"
        onClick={() => onSaveSettings({
          widgetName, layer, color, displayFilter, isFullscreen,
        })}>
        Save settings
      </Button>
      <Divider />
      <Typography variant="subtitle2">
        Fields
      </Typography>
      <OverlayWidgetForm model={overlay.model}
        value={overlay.data.widget}
        onSubmit={onSaveWidget} />
    </Box>
  )
}
