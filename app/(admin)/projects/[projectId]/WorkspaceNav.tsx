'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, Tab, Box } from '@mui/material'

export default function WorkspaceNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const dataHref = `/projects/${projectId}/data`
  const overlaysHref = `/projects/${projectId}/rundowns`

  const value = pathname.startsWith(overlaysHref) ? overlaysHref : dataHref

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value}>
        <Tab label="Data"
          value={dataHref}
          component={Link}
          href={dataHref} />
        <Tab label="Overlays"
          value={overlaysHref}
          component={Link}
          href={overlaysHref} />
        <Tab label="MIDI"
          value="midi-disabled"
          disabled
          aria-disabled="true" />
        <Tab label="Bluetooth"
          value="bluetooth-disabled"
          disabled
          aria-disabled="true" />
      </Tabs>
    </Box>
  )
}
