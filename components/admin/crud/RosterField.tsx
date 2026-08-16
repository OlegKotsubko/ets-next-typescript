'use client'
import { useState } from 'react'
import {
  Box, Button, IconButton, MenuItem, TextField, Checkbox, FormControlLabel, Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { useListPlayersQuery } from '@/store/apis/playersApi'
import type { Player } from '@/lib/entities/players'

type RosterRow = { playerId: number; isCaptain: boolean; isStandIn: boolean }

// Edits a team's roster (team_players) as { playerId, isCaptain, isStandIn }
// rows, picking from the project's players. Local row state layered over the
// controlled value; the parent keys this field by the edited team.
export function RosterField({
  projectId, value, onChange, label = 'Roster',
}: {
  projectId: string
  value: RosterRow[]
  onChange: (next: RosterRow[]) => void
  label?: string
}) {
  const { data: players = [] } = useListPlayersQuery(projectId)
  const [rows, setRows] = useState<RosterRow[]>(() => value ?? [])

  function commit(next: RosterRow[]) {
    setRows(next)
    onChange(next.filter((r) => r.playerId))
  }

  function patch(i: number, p: Partial<RosterRow>) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }

  return (
    <Box>
      <Typography variant="caption"
        color="text.secondary">
        {label}
      </Typography>
      {rows.map((row, i) => (
        <Box key={i}
          sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
          <TextField select
            size="small"
            label={`Player ${i + 1}`}
            value={row.playerId || ''}
            onChange={(e) => patch(i, { playerId: Number(e.target.value) })}
            sx={{ minWidth: 180 }}>
            <MenuItem value="">
              Empty
            </MenuItem>
            {players.map((p: Player) => (
              <MenuItem key={p.id}
                value={p.id}>
                {p.nickname}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel label="Captain"
            control={(
              <Checkbox checked={row.isCaptain}
                onChange={(e) => patch(i, { isCaptain: e.target.checked })} />
            )} />
          <FormControlLabel label="Stand-in"
            control={(
              <Checkbox checked={row.isStandIn}
                onChange={(e) => patch(i, { isStandIn: e.target.checked })} />
            )} />
          <IconButton aria-label="Remove member"
            onClick={() => commit(rows.filter((_, idx) => idx !== i))}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small"
        onClick={() => commit([...rows, { playerId: 0, isCaptain: false, isStandIn: false }])}
        sx={{ mt: 1 }}>
        Add member
      </Button>
    </Box>
  )
}
