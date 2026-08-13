'use client'
import { use } from 'react'
import Link from 'next/link'
import { Box, Typography, List, ListItemButton, ListItemText } from '@mui/material'

const SECTIONS = [
  { slug: 'players', label: 'Players' },
  { slug: 'talents', label: 'Talents' },
  { slug: 'teams', label: 'Teams' },
  { slug: 'sponsors', label: 'Sponsors' },
  { slug: 'videos', label: 'Videos' },
  { slug: 'assets', label: 'Assets' },
  { slug: 'brackets', label: 'Brackets' },
  { slug: 'css', label: 'Project CSS' },
]

export default function DataHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4"
        gutterBottom>
Data
      </Typography>
      <List>
        {SECTIONS.map((s) => (
          <ListItemButton key={s.slug}
            component={Link}
            href={`/projects/${projectId}/data/${s.slug}`}>
            <ListItemText primary={s.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
