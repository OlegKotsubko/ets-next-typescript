'use client'
import { Box, Card, Typography } from '@mui/material'

// Middle-column top: the etalon's ControllerThread widget area (thread-widget
// action buttons — timers' start/stop/reset, `next`, etc.). Thread-widget
// actions are deferred; this is the seam that will host them.
export function ControllerThreadWidgets() {
  return (
    <Card sx={{ p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography variant="h6"
        fontWeight="bold"
        sx={{ mb: 1 }}>
        Thread
      </Typography>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'center' }}>
          Thread-widget actions coming soon.
        </Typography>
      </Box>
    </Card>
  )
}
