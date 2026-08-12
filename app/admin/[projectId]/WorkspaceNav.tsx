'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, Tab, Box } from '@mui/material'

export default function WorkspaceNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const dataHref = `/admin/${projectId}/data`
  const rundownsHref = `/admin/${projectId}/rundowns`

  const value = pathname.startsWith(rundownsHref) ? rundownsHref : dataHref

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value}>
        <Tab label="Data"
          value={dataHref}
          component={Link}
          href={dataHref} />
        <Tab label="Rundowns"
          value={rundownsHref}
          component={Link}
          href={rundownsHref} />
        <Tab label="Midi"
          value="midi-disabled"
          disabled
          aria-disabled="true" />
      </Tabs>
    </Box>
  )
}
