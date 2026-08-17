import {
  Box, Button, Card, Typography,
} from '@mui/material'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { OverlayColorFilter } from './OverlayColorFilter'
import { OverlayCard } from './OverlayCard'

export function RundownOverlayListing({
  overlays, activeColors, selectedId,
  onToggleColor, onSelect, onReorder, onDelete, onAdd,
}: {
  overlays: RundownOverlay[]
  activeColors: Set<number>
  selectedId: number | null
  onToggleColor: (color: number) => void
  onSelect: (id: number) => void
  onReorder: (orderedIds: number[]) => void
  onDelete: (id: number) => void
  onAdd: () => void
}) {
  const filtering = activeColors.size > 0
  const visible = filtering ? overlays.filter((o) => activeColors.has(o.color)) : overlays

  function move(index: number, dir: -1 | 1) {
    const ids = overlays.map((o) => o.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const tmp = ids[index]
    ids[index] = ids[j]
    ids[j] = tmp
    onReorder(ids)
  }

  return (
    <Card sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography variant="h6">
          Overlays
        </Typography>
        <OverlayColorFilter active={activeColors}
          onToggle={onToggleColor} />
      </Box>
      <Button variant="contained"
        fullWidth
        onClick={onAdd}
        sx={{ mb: 2 }}>
        Add overlay
      </Button>
      {visible.length === 0 ? (
        <Typography color="text.secondary"
          variant="body2">
          {filtering ? 'No overlays for this color.' : 'No overlays yet — click Add overlay.'}
        </Typography>
      ) : null}
      {visible.map((o) => (
        <OverlayCard key={o.id}
          overlay={o}
          selected={o.id === selectedId}
          reorderable={!filtering}
          canMoveUp={overlays.indexOf(o) > 0}
          canMoveDown={overlays.indexOf(o) < overlays.length - 1}
          onSelect={() => onSelect(o.id)}
          onMoveUp={() => move(overlays.indexOf(o), -1)}
          onMoveDown={() => move(overlays.indexOf(o), 1)}
          onDelete={() => onDelete(o.id)} />
      ))}
    </Card>
  )
}
