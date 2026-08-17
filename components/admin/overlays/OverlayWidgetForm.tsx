'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box, Button, TextField, MenuItem, Checkbox, FormControlLabel,
} from '@mui/material'
import { describeModel, getOverlayModel } from '@/lib/overlays/catalog'

// Renders an overlay's widget schema (FieldDescriptors) as a form. Numbers may
// submit as strings; the API coerces them against the same model on save.
export function OverlayWidgetForm({
  model, value, onSubmit,
}: {
  model: string
  value: Record<string, unknown>
  onSubmit: (widget: Record<string, unknown>) => void
}) {
  const fields = describeModel(model)
  const zodModel = getOverlayModel(model)
  const { control, handleSubmit } = useForm({
    resolver: zodModel ? zodResolver(zodModel as never) : undefined,
    defaultValues: value,
  })

  return (
    <Box component="form"
      onSubmit={handleSubmit((d) => onSubmit(d as Record<string, unknown>))}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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
      <Button type="submit"
        variant="outlined">
        Save fields
      </Button>
    </Box>
  )
}
