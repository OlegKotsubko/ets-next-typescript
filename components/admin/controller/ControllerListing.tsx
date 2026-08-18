'use client'
import { useMemo, useState } from 'react'
import {
  Box, Card, Typography,
} from '@mui/material'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import { OverlayColorFilter } from '@/components/admin/overlays/OverlayColorFilter'
import { ControllerCard } from './ControllerCard'

// Port of etalon ControllerListing: header (title + color filter) over a
// scrollable list of overlay cards, filtered by the active color set.
export function ControllerListing({
  overlays, projectId, rundownId, previewIds, airIds,
}: {
  overlays: RundownOverlay[]
  projectId: string
  rundownId: string | number
  previewIds: Set<number>
  airIds: Set<number>
}) {
  const [active, setActive] = useState<Set<number>>(new Set())

  function toggle(color: number) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  const availableColors = useMemo(
    () => new Set(overlays.map((o) => o.color)),
    [overlays],
  )
  const filtered = useMemo(
    () => (active.size === 0 ? overlays : overlays.filter((o) => active.has(o.color))),
    [overlays, active],
  )

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 2,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}>
        <Typography variant="h6"
          fontWeight="bold">
          Templates
        </Typography>
        {availableColors.size ? (
          <OverlayColorFilter active={active}
            onToggle={toggle} />
        ) : null}
      </Box>
      <Box sx={{
        flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 1,
      }}>
        {filtered.map((o) => (
          <ControllerCard key={o.id}
            overlay={o}
            projectId={projectId}
            rundownId={rundownId}
            isPreview={previewIds.has(o.id)}
            isAir={airIds.has(o.id)} />
        ))}
        {filtered.length === 0 ? (
          <Typography color="text.secondary"
            sx={{ p: 2 }}>
            No overlays in this rundown yet.
          </Typography>
        ) : null}
      </Box>
    </Card>
  )
}
