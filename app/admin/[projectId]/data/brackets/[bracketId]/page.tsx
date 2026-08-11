'use client'
import { use } from 'react'
import { Box, Typography, TextField, MenuItem, Stack, Paper } from '@mui/material'
import { useListBracketsQuery, useUpdateMatchMutation } from '@/store/apis/bracketsApi'
import type { BracketMatch } from '@/db/schemas/brackets'

export default function BracketDetailPage({ params }: { params: Promise<{ projectId: string; bracketId: string }> }) {
  const { projectId, bracketId } = use(params)
  const { data: brackets = [] } = useListBracketsQuery(projectId)
  const [updateMatch] = useUpdateMatchMutation()
  const bracket = brackets.find((b) => b.id === bracketId)

  if (!bracket) return <Typography>Loading…</Typography>

  function patchMatch(matchId: string, data: Partial<BracketMatch>) {
    updateMatch({ projectId, bracketId, matchId, data })
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{bracket.name}</Typography>
      <Stack direction="row" spacing={3}>
        {bracket.rounds.map((round) => (
          <Box key={round.name}>
            <Typography variant="subtitle1">{round.name}</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {round.matches.map((match) => (
                <Paper key={match.id} sx={{ p: 2 }}>
                  <Typography variant="body2">{match.name}</Typography>
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={match.status}
                    onChange={(e) => patchMatch(match.id, { status: e.target.value as BracketMatch['status'] })}
                    sx={{ mt: 1, minWidth: 140 }}
                  >
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="finished">Finished</MenuItem>
                  </TextField>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      type="number"
                      label="Score L"
                      value={match.scoreLeft}
                      onChange={(e) => patchMatch(match.id, { scoreLeft: Number(e.target.value) })}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Score R"
                      value={match.scoreRight}
                      onChange={(e) => patchMatch(match.id, { scoreRight: Number(e.target.value) })}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
