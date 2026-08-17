import { Box, IconButton, Tooltip } from '@mui/material'
import { overlayColor } from './overlayColors'

const COLORS = [1, 2, 3, 4, 5, 6, 7]

export function OverlayColorFilter({
  active, onToggle,
}: {
  active: Set<number>
  onToggle: (color: number) => void
}) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {COLORS.map((n) => (
        <Tooltip key={n}
          title={`Color ${n}`}>
          <IconButton size="small"
            aria-label={`Color ${n}`}
            onClick={() => onToggle(n)}
            sx={{
              width: 20,
              height: 20,
              p: 0,
              bgcolor: overlayColor(n),
              opacity: active.size === 0 || active.has(n) ? 1 : 0.3,
              border: active.has(n) ? '2px solid' : '2px solid transparent',
              borderColor: active.has(n) ? 'text.primary' : 'transparent',
              '&:hover': { bgcolor: overlayColor(n) },
            }} />
        </Tooltip>
      ))}
    </Box>
  )
}
