'use client'
import { useEffect, useRef, useState } from 'react'
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { listOverlays, listCategories, getOverlayModel } from '@/lib/overlays/catalog'
import { getOverlayRender } from '@/lib/overlays/render'

// Dev-only harness to eyeball overlays with sample data + GSAP. The real
// /preview·/air SSE pages arrive with the broadcast pass.
const sampleMatch = {
  participant_left: { name: 'Team Alpha', score: 1 },
  participant_right: { name: 'Team Omega', score: 2 },
}

// Placeholder theme variables (the active tournament theme supplies these on air).
const themeVars: React.CSSProperties = {
  ['--color-primary' as string]: '#ffffff',
  ['--color-accent' as string]: '#ffd400',
  ['--color-bg-accent' as string]: 'rgba(0,0,0,0.6)',
  ['--color-bg' as string]: 'rgba(10,10,20,0.92)',
  ['--font-display' as string]: 'system-ui, sans-serif',
}

export default function DevOverlaysPage() {
  const options = listOverlays(listCategories())
  const [model, setModel] = useState(options[0]?.model ?? '')
  const [nonce, setNonce] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  const render = getOverlayRender(model)
  const widget = (model ? getOverlayModel(model)?.parse({}) : {}) as Record<string, unknown>

  useEffect(() => {
    const root = stageRef.current?.firstElementChild as HTMLElement | null
    if (root && render) render.animationIn(root)
  }, [model, nonce, render])

  function playOut() {
    const root = stageRef.current?.firstElementChild as HTMLElement | null
    if (root && render) render.animationOut(root)
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4"
        sx={{ mb: 2 }}>
        Overlay preview (dev)
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField select
          label="Overlay"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          sx={{ minWidth: 260 }}>
          {options.map((o) => (
            <MenuItem key={o.model}
              value={o.model}>
              {`${o.widgetName} (${o.category})`}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined"
          onClick={() => setNonce((n) => n + 1)}>
          Replay in
        </Button>
        <Button variant="outlined"
          onClick={playOut}>
          Play out
        </Button>
      </Box>

      {/* 1920x1080 stage scaled to 0.5; the transform also makes this box the
          containing block for the overlays' position: fixed. */}
      <Box sx={{
        width: 960,
        height: 540,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #444',
        background: 'repeating-conic-gradient(#1e1e1e 0% 25%, #2a2a2a 0% 50%) 50% / 48px 48px',
      }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            transform: 'scale(0.5)',
            transformOrigin: 'top left',
            ...themeVars,
          }}
        >
          <div ref={stageRef}
            key={`${model}-${nonce}`}>
            {render ? <render.Component data={{ widget, match: sampleMatch }} /> : null}
          </div>
        </div>
      </Box>
    </Box>
  )
}
