'use client'
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Checkbox, ListItemText, Select, InputLabel, FormControl, OutlinedInput,
} from '@mui/material'
import { listCategories } from '@/lib/overlays/catalog'

const STATUSES = ['draft', 'upcoming', 'ongoing', 'ended'] as const

export type TournamentFormValues = { title: string; status: string; overlayPacks: string[] }

export function TournamentFormDialog({
  open, initial, onClose, onSubmit,
}: {
  open: boolean
  initial?: TournamentFormValues
  onClose: () => void
  onSubmit: (d: TournamentFormValues) => void
}) {
  const packs = listCategories()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'draft')
  const [selected, setSelected] = useState<string[]>(initial?.overlayPacks ?? [])

  return (
    <Dialog open={open}
      onClose={onClose}
      fullWidth>
      <DialogTitle>
        {initial ? 'Edit tournament' : 'New tournament'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus />
        <TextField select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <MenuItem key={s}
              value={s}
              sx={{ textTransform: 'capitalize' }}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <FormControl>
          <InputLabel id="overlay-packs-label">
            Overlay packs
          </InputLabel>
          <Select multiple
            labelId="overlay-packs-label"
            value={selected}
            input={<OutlinedInput label="Overlay packs" />}
            onChange={(e) => setSelected(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            renderValue={(v) => (v as string[]).join(', ')}>
            {packs.length === 0 ? (
              <MenuItem disabled
                value="">
                No overlay packs found
              </MenuItem>
            ) : packs.map((p) => (
              <MenuItem key={p}
                value={p}>
                <Checkbox checked={selected.includes(p)} />
                <ListItemText primary={p} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained"
          disabled={!title.trim()}
          onClick={() => onSubmit({ title: title.trim(), status, overlayPacks: selected })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
