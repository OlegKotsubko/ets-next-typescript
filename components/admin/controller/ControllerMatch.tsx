'use client'
import { Box, Card, Typography } from '@mui/material'

// Middle-column bottom: the etalon's ControllerMatch (selected match, teams,
// seating). Match/participant payload collection is deferred; this is the seam
// that will host the match picker.
export function ControllerMatch() {
  return (
    <Card sx={{ p: 1.5, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Typography variant="h6"
        fontWeight="bold"
        sx={{ mb: 1 }}>
        Match
      </Typography>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'center' }}>
          Match / seating panel coming soon.
        </Typography>
      </Box>
    </Card>
  )
}
