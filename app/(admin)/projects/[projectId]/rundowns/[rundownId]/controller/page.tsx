'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  Box, Button, Card, CardContent, MenuItem, TextField, Typography, Chip,
} from '@mui/material'
import { useListRundownOverlaysQuery } from '@/store/apis/rundownOverlaysApi'
import { useListDisplaysQuery, useCreateDisplayMutation } from '@/store/apis/displaysApi'
import { useGetSettingsQuery, useSetSettingsMutation } from '@/store/apis/settingsApi'
import {
  usePreviewMutation, useAirMutation, useHideMutation, useHideAllMutation,
} from '@/store/apis/broadcastApi'

export default function ControllerPage({ params }: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: overlays = [] } = useListRundownOverlaysQuery({ projectId, rundownId })
  const { data: displays = [] } = useListDisplaysQuery(projectId)
  const { data: settings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()
  const [createDisplay] = useCreateDisplayMutation()
  const [preview] = usePreviewMutation()
  const [air] = useAirMutation()
  const [hide] = useHideMutation()
  const [hideAll] = useHideAllMutation()

  // Derived, not synced-via-effect: an explicit pick wins, else the saved
  // active display, else the first available.
  const [pickedId, setPickedId] = useState<number | null>(null)
  const displayId = pickedId ?? settings?.displayId ?? displays[0]?.id ?? null
  const display = displays.find((d) => d.id === displayId) ?? null

  async function pickDisplay(id: number) {
    setPickedId(id)
    await setSettings({ displayId: id })
  }
  async function addDisplay() {
    const created = await createDisplay({ projectId, name: `Display ${displays.length + 1}` }).unwrap()
    await pickDisplay(created.id)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Button component={Link}
        href={`/projects/${projectId}/rundowns/${rundownId}`}
        size="small">
        ← Editor
      </Button>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', my: 2 }}>
        <TextField select
          label="Display"
          size="small"
          value={displayId ?? ''}
          onChange={(e) => pickDisplay(Number(e.target.value))}
          sx={{ minWidth: 200 }}>
          {displays.map((d) => <MenuItem key={d.id}
            value={d.id}>
            {d.name}
          </MenuItem>)}
        </TextField>
        <Button onClick={addDisplay}
          variant="outlined"
          size="small">
          + Display
        </Button>
        {display ? (
          <Button color="error"
            variant="outlined"
            size="small"
            onClick={() => display && hideAll({ projectId, displayId: display.id, channel: 'air' })}>
            Hide all (air)
          </Button>
        ) : null}
      </Box>

      {!display ? (
        <Typography color="text.secondary">
          Create a display to start broadcasting.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
          <Box>
            {overlays.map((o) => (
              <Card key={o.id}
                sx={{ mb: 1 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small"
                    label={`L${o.layer}`} />
                  <Typography sx={{ flex: 1 }}>
                    {o.widgetName}
                  </Typography>
                  <Button size="small"
                    onClick={() => preview({ projectId, displayId: display.id, overlayId: o.id })}>
                    Stage
                  </Button>
                  <Button size="small"
                    variant="contained"
                    onClick={() => air({ projectId, displayId: display.id, overlayId: o.id })}>
                    Take
                  </Button>
                  <Button size="small"
                    color="error"
                    onClick={() => hide({ projectId, displayId: display.id, overlayId: o.id, channel: 'air' })}>
                    Hide
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption">
              Preview
            </Typography>
            <Box component="iframe"
              title="preview"
              src={`/preview/${display.uuid}`}
              sx={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid', borderColor: 'divider', bgcolor: '#111' }} />
            <Typography variant="caption">
              Air
            </Typography>
            <Box component="iframe"
              title="air"
              src={`/air/${display.uuid}`}
              sx={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid', borderColor: 'divider', bgcolor: '#111' }} />
          </Box>
        </Box>
      )}
    </Box>
  )
}
