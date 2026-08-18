'use client'
import { use } from 'react'
import Link from 'next/link'
import { Box, Button, Typography } from '@mui/material'
import { useListRundownOverlaysQuery } from '@/store/apis/rundownOverlaysApi'
import { useGetRundownQuery } from '@/store/apis/rundownsApi'
import { useRundownLiveSets } from '@/lib/broadcast/useRundownLiveSets'
import { ControllerListing } from '@/components/admin/controller/ControllerListing'
import { ControllerThread } from '@/components/admin/controller/ControllerThread'
import { ControllerThreadWidgets } from '@/components/admin/controller/ControllerThreadWidgets'
import { ControllerMatch } from '@/components/admin/controller/ControllerMatch'
import { ControllerMonitors } from '@/components/admin/controller/ControllerMonitors'

export default function ControllerPage({ params }: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: overlays = [] } = useListRundownOverlaysQuery({ projectId, rundownId })
  const { data: rundown } = useGetRundownQuery({ projectId, id: Number(rundownId) })

  // Broadcast is addressed by the rundown's public uuid; the controller drives
  // it directly — no display entity to pick.
  const { previewIds, airIds } = useRundownLiveSets(rundown?.uuid ?? null)

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link}
          href={`/projects/${projectId}/rundowns/${rundownId}`}
          size="small">
          ← Editor
        </Button>
        <Typography variant="h6"
          sx={{ flex: 1 }}
          noWrap>
          {rundown?.name ?? 'Controller'}
        </Typography>
      </Box>

      {!rundown ? (
        <Typography color="text.secondary">
          Loading rundown…
        </Typography>
      ) : (
        <Box sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '35% 22% 43%' },
        }}>
          {/* Left: the rundown's overlays */}
          <Box sx={{ minHeight: 0 }}>
            <ControllerListing overlays={overlays}
              projectId={projectId}
              rundownId={rundownId}
              previewIds={previewIds}
              airIds={airIds} />
          </Box>
          {/* Middle: thread widgets → Hide/AIR switcher → match */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
            <ControllerThreadWidgets />
            <ControllerThread projectId={projectId}
              rundownId={rundownId} />
            <ControllerMatch />
          </Box>
          {/* Right: preview + air monitors */}
          <Box sx={{ minHeight: 0 }}>
            <ControllerMonitors uuid={rundown.uuid}
              airCount={airIds.size} />
          </Box>
        </Box>
      )}
    </Box>
  )
}
