'use client'
import { Box, TextField, IconButton, Button, Stack } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Extra } from '@/db/schemas/shared'

export function ExtraMapField({ value, onChange }: { value: Extra; onChange: (next: Extra) => void }) {
  const entries = Object.entries(value)

  function updateRow(index: number, key: string, val: string) {
    const next: Extra = {}
    entries.forEach(([k, v], i) => {
      if (i === index) next[key] = val
      else next[k] = v
    })
    onChange(next)
  }

  function removeRow(index: number) {
    const next: Extra = {}
    entries.forEach(([k, v], i) => {
      if (i !== index) next[k] = v
    })
    onChange(next)
  }

  return (
    <Box>
      <Stack spacing={1}>
        {entries.map(([k, v], i) => (
          <Stack direction="row" spacing={1} key={i} alignItems="center">
            <TextField size="small" label="key" value={k} onChange={(e) => updateRow(i, e.target.value, v)} />
            <TextField size="small" label="value" value={v} onChange={(e) => updateRow(i, k, e.target.value)} />
            <IconButton aria-label="remove field" onClick={() => removeRow(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" onClick={() => onChange({ ...value, '': '' })} sx={{ mt: 1 }}>
        Add field
      </Button>
    </Box>
  )
}
