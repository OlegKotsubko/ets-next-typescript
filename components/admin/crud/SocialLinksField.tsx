'use client'
import { useState } from 'react'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

type LinksMap = Record<string, string>

// Edits a { type: link } map as repeatable { type, link } rows. Local row state
// holds in-progress (possibly blank) rows; onChange emits the cleaned map. The
// parent keys this field by the edited entity so state re-inits on row switch.
export function SocialLinksField({
  value, onChange, label = 'Social links',
}: {
  value: LinksMap
  onChange: (next: LinksMap) => void
  label?: string
}) {
  const [rows, setRows] = useState<[string, string][]>(() => Object.entries(value ?? {}))

  function commit(next: [string, string][]) {
    setRows(next)
    const map: LinksMap = {}
    for (const [type, link] of next) {
      if (type.trim()) map[type.trim()] = link
    }
    onChange(map)
  }

  return (
    <Box>
      <Typography variant="caption"
        color="text.secondary">
        {label}
      </Typography>
      {rows.map(([type, link], i) => (
        <Box key={i}
          sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField size="small"
            label="Type"
            value={type}
            onChange={(e) => commit(rows.map((r, idx) => (idx === i ? [e.target.value, link] : r)))} />
          <TextField size="small"
            fullWidth
            label="Link"
            value={link}
            onChange={(e) => commit(rows.map((r, idx) => (idx === i ? [type, e.target.value] : r)))} />
          <IconButton aria-label="Remove link"
            onClick={() => commit(rows.filter((_, idx) => idx !== i))}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small"
        onClick={() => commit([...rows, ['', '']])}
        sx={{ mt: 1 }}>
        Add link
      </Button>
    </Box>
  )
}
