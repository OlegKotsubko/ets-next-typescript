'use client'
import { useState } from 'react'
import { Box, MenuItem, TextField, Checkbox, FormControlLabel, Button, Stack, Typography } from '@mui/material'
import { useListPlayersQuery } from '@/store/apis/playersApi'
import { useReplaceRosterMutation } from '@/store/apis/teamsApi'

type Slot = { playerId: string; isCaptain: boolean; isStandIn: boolean }

export function TeamRosterEditor({ projectId, teamId }: { projectId: string; teamId: string }) {
  const { data: players = [] } = useListPlayersQuery(projectId)
  const [replaceRoster] = useReplaceRosterMutation()
  const [slots, setSlots] = useState<(Slot | null)[]>([null, null, null, null, null])

  function updateSlot(index: number, patch: Partial<Slot>) {
    setSlots((prev) => {
      const next = [...prev]
      next[index] = { playerId: '', isCaptain: false, isStandIn: false, ...next[index], ...patch }
      return next
    })
  }

  async function save() {
    const data = {
      slots: slots
        .map((s, i) => (s?.playerId ? { playerId: s.playerId, slot: i, isCaptain: s.isCaptain, isStandIn: s.isStandIn } : null))
        .filter((s): s is NonNullable<typeof s> => s !== null),
    }
    await replaceRoster({ projectId, teamId, data })
  }

  return (
    <Box>
      <Typography variant="subtitle1"
        sx={{ mb: 1 }}>
Roster
      </Typography>
      <Stack spacing={1}>
        {slots.map((slot, i) => (
          <Stack direction="row"
            spacing={1}
            alignItems="center"
            key={i}>
            <TextField
              select
              size="small"
              label={`Slot ${i + 1}`}
              value={slot?.playerId ?? ''}
              onChange={(e) => updateSlot(i, { playerId: e.target.value })}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">
Empty
              </MenuItem>
              {players.map((p: { id: string; name: string }) => <MenuItem key={p.id}
                value={p.id}>
                {p.name}
              </MenuItem>)}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={slot?.isCaptain ?? false}
                onChange={(e) => updateSlot(i, { isCaptain: e.target.checked })} />}
              label="Captain"
            />
            <FormControlLabel
              control={<Checkbox checked={slot?.isStandIn ?? false}
                onChange={(e) => updateSlot(i, { isStandIn: e.target.checked })} />}
              label="Stand-in"
            />
          </Stack>
        ))}
      </Stack>
      <Button variant="outlined"
        onClick={save}
        sx={{ mt: 2 }}>
Save Roster
      </Button>
    </Box>
  )
}
