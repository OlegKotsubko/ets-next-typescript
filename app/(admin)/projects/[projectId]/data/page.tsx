'use client'
import { use } from 'react'
import Link from 'next/link'
import { Box, Typography, List, ListItemButton, ListItemText } from '@mui/material'

const SECTIONS = [
  { slug: 'players', label: 'Players' },
  { slug: 'teams', label: 'Teams' },
  { slug: 'talents', label: 'Talents' },
  { slug: 'sponsors', label: 'Sponsors' },
  { slug: 'themes', label: 'Themes' },
  { slug: 'matches', label: 'Matches' },
  { slug: 'brackets', label: 'Brackets' },
  { slug: 'assets', label: 'Assets' },
  { slug: 'videos', label: 'Videos' },
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
