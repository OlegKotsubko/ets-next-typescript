'use client'
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Alert, Box,
} from '@mui/material'
import type { TitleOption } from '@/lib/titles/listTitleOptions'
import type { CreateRundownItemInput } from '@/db/schemas/rundown-items'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'

const COLOR_HEX: Record<string, string> = { red: '#e53935', green: '#43a047', blue: '#1e88e5', yellow: '#fdd835' }

// Prop-driven so it is store-free and unit-testable: the page supplies the
// title options and an onCreate wired to the createItem mutation.
export function AddTemplateModal({
  open, options, onClose, onCreate,
}: {
  open: boolean
  options: TitleOption[]
  onClose: () => void
  onCreate: (_payload: CreateRundownItemInput) => Promise<unknown>
}) {
  const [titleKey, setTitleKey] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitleKey('')
    setLabel('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleAdd() {
    const option = options.find((o) => o.key === titleKey)
    if (!option) return
    setError(null)
    setSaving(true)
    try {
      await onCreate({ titleKey, label: label.trim() || undefined, data: option.defaults })
      reset()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add template. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm">
      <DialogTitle>
        Add Template
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error">
          {error}
        </Alert>}
        <TextField select
          label="Template"
          value={titleKey}
          onChange={(e) => setTitleKey(e.target.value)}>
          {options.map((o) => (
            <MenuItem key={o.key}
              value={o.key}>
              <Box component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                {o.color && (
                  <Box component="span"
                    sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: COLOR_HEX[o.color] ?? o.color }} />
                )}
                {o.name}
              </Box>
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="contained"
          onClick={handleAdd}
          disabled={!titleKey || saving}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  )
}
