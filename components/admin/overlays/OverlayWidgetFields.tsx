'use client'
import { Controller, type Control } from 'react-hook-form'
import {
  Box, TextField, MenuItem, Checkbox, FormControlLabel,
} from '@mui/material'
import { describeModel } from '@/lib/overlays/catalog'

// The overlay widget-schema inputs, rendered against a caller-owned RHF form.
// Sharing the `control` lets a parent (a controller card) submit the current
// field values directly — so staging always uses what the operator just typed.
export function OverlayWidgetFields({
  model, control,
}: {
  model: string
  // Third generic (transformed values) is `unknown` when a zod resolver is set.
  control: Control<Record<string, unknown>, unknown, unknown>
}) {
  const fields = describeModel(model)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      {fields.map((f) => (
        <Controller key={f.name}
          name={f.name}
          control={control}
          render={({ field, fieldState }) => {
            if (f.input_type === 'checkbox') {
              return (
                <FormControlLabel label={f.label}
                  control={<Checkbox checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.target.checked)} />} />
              )
            }
            if (f.input_type === 'select') {
              return (
                <TextField select
                  label={f.label}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}>
                  {(f.choices ?? []).map(([v, l]) => <MenuItem key={v}
                    value={v}>
                    {l}
                  </MenuItem>)}
                </TextField>
              )
            }
            if (f.input_type === 'list_object') {
              const text = typeof field.value === 'string' ? field.value : JSON.stringify(field.value ?? [], null, 2)
              return (
                <TextField label={`${f.label} (JSON)`}
                  multiline
                  minRows={3}
                  value={text}
                  onChange={(e) => field.onChange(e.target.value)} />
              )
            }
            return (
              <TextField label={f.label}
                type={f.input_type === 'number' ? 'number' : 'text'}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? (f.can_live_update ? 'live-updatable' : undefined)} />
            )
          }} />
      ))}
    </Box>
  )
}
