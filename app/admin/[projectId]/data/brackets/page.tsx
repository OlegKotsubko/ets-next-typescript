'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { Box, Button, TextField, Typography, List, ListItemButton } from '@mui/material'
import { useListBracketsQuery, useCreateBracketMutation } from '@/store/apis/bracketsApi'

export default function BracketsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: brackets = [] } = useListBracketsQuery(projectId)
  const [createBracket] = useCreateBracketMutation()
  const [name, setName] = useState('')
  const [participantCount, setParticipantCount] = useState(4)

  async function handleCreate() {
    await createBracket({ projectId, data: { name, participantCount } })
    setName('')
  }

  return (
    <Box>
      <Typography variant="h5"
        sx={{ mb: 2 }}>
Brackets
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small" />
        <TextField
          label="Participants"
          type="number"
          value={participantCount}
          onChange={(e) => setParticipantCount(Number(e.target.value))}
          size="small"
        />
        <Button variant="contained"
          onClick={handleCreate}>
Generate
        </Button>
      </Box>
      <List>
        {brackets.map((b) => (
          <ListItemButton key={b.id}
            component={Link}
            href={`/admin/${projectId}/data/brackets/${b.id}`}>
            {b.name}
            {' '}
(
            {b.participantCount}
            {' '}
participants)
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
