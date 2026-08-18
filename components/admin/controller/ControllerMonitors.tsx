'use client'
import { useState } from 'react'
import {
  Box, Card, FormControlLabel, IconButton, MenuItem, Snackbar, Switch, TextField, Tooltip, Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNewOutlined'

const DISPLAY_FILTERS = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

// Port of etalon ControllerPreview + ControllerAir: the two live iframes with a
// display-filter selector and copy / open-in-new for the air share URL. The red
// "on air" dot lights when the air set is non-empty.
export function ControllerMonitors({
  uuid, airCount,
}: {
  uuid: string
  airCount: number
}) {
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const [airVisible, setAirVisible] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const query = filter ? `?filter=${filter}` : ''
  const airUrl = `${origin}/air/${uuid}${query}`
  const previewSrc = `/preview/${uuid}`
  const airSrc = `/air/${uuid}${query}`

  function copy() {
    navigator.clipboard.writeText(airUrl).then(() => setCopied(true))
  }

  const frameSx = {
    width: '100%',
    aspectRatio: '16 / 9',
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: '#111',
  } as const

  return (
    <Card sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6"
          fontWeight="bold"
          sx={{ flex: 1 }}>
          Monitors
        </Typography>
        <FormControlLabel label={`Air ${airVisible ? 'on' : 'off'}`}
          control={<Switch checked={airVisible}
            onChange={(e) => setAirVisible(e.target.checked)} />} />
        <TextField select
          size="small"
          label="Display filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ width: 140 }}>
          {DISPLAY_FILTERS.map((v) => (
            <MenuItem key={v || 'all'}
              value={v}>
              {v || 'all'}
            </MenuItem>
          ))}
        </TextField>
        <Tooltip title="Copy air URL">
          <IconButton onClick={copy}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Open air in new tab">
          <IconButton onClick={() => window.open(airUrl, '_blank')}>
            <OpenInNewIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box>
        <Typography variant="caption"
          color="text.secondary">
          Preview
        </Typography>
        <Box component="iframe"
          title="preview"
          src={previewSrc}
          sx={frameSx} />
      </Box>

      {airVisible ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption"
              color="text.secondary">
              Air
            </Typography>
            {airCount > 0 ? (
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main',
              }} />
            ) : null}
          </Box>
          <Box component="iframe"
            title="air"
            src={airSrc}
            sx={frameSx} />
        </Box>
      ) : null}

      <Snackbar open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Air URL copied" />
    </Card>
  )
}
