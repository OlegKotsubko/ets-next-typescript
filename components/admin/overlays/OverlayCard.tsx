import {
  Box, Card, CardContent, Chip, IconButton, Typography,
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteIcon from '@mui/icons-material/Delete'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { overlayColor } from './overlayColors'
import { OverlayThumbnail } from './OverlayThumbnail'

export function OverlayCard({
  overlay, selected, reorderable, canMoveUp, canMoveDown,
  onSelect, onMoveUp, onMoveDown, onDelete,
}: {
  overlay: RundownOverlay
  selected: boolean
  reorderable: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  function stop(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      fn()
    }
  }
  return (
    <Card onClick={onSelect}
      sx={{
        mb: 1,
        cursor: 'pointer',
        position: 'relative',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
      }}>
      <Box sx={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: overlayColor(overlay.color),
      }} />
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 3 }}>
        <OverlayThumbnail src={overlay.previewImg}
          label={overlay.category ?? overlay.model} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1"
            noWrap>
            {overlay.widgetName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small"
              label={overlay.category ?? overlay.model} />
            <Chip size="small"
              label={`L${overlay.layer}`} />
            {overlay.displayFilter ? (
              <Chip size="small"
                label={`display ${overlay.displayFilter}`} />
            ) : null}
          </Box>
        </Box>
        {reorderable ? (
          <>
            <IconButton size="small"
              aria-label="Move up"
              disabled={!canMoveUp}
              onClick={stop(onMoveUp)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
              aria-label="Move down"
              disabled={!canMoveDown}
              onClick={stop(onMoveDown)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </>
        ) : null}
        <IconButton size="small"
          aria-label="Delete"
          color="error"
          onClick={stop(onDelete)}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </CardContent>
    </Card>
  )
}
