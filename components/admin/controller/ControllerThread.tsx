'use client'
import { Box, Button } from '@mui/material'
import { useAirAllMutation, useHideAllMutation } from '@/store/apis/broadcastApi'

// Port of etalon ControllerThreadButtons: the two master switcher buttons.
// AIR takes the whole staged preview set to air; Hide clears the air set.
export function ControllerThread({
  projectId, rundownId,
}: {
  projectId: string
  rundownId: string | number
}) {
  const [airAll] = useAirAllMutation()
  const [hideAll] = useHideAllMutation()

  async function hideEverything() {
    await hideAll({ projectId, rundownId, channel: 'air' })
    await hideAll({ projectId, rundownId, channel: 'preview' })
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
      <Button color="warning"
        variant="contained"
        size="large"
        sx={{ height: 56, fontSize: 24 }}
        onClick={hideEverything}>
        Hide
      </Button>
      <Button color="error"
        variant="contained"
        size="large"
        sx={{ height: 56, fontSize: 24 }}
        onClick={() => airAll({ projectId, rundownId })}>
        AIR
      </Button>
    </Box>
  )
}
