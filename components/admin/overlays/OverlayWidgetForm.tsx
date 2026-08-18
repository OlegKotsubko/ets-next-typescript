'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button } from '@mui/material'
import { getOverlayModel } from '@/lib/overlays/catalog'
import { OverlayWidgetFields } from './OverlayWidgetFields'

// Editor form: renders an overlay's widget schema and saves on submit. Numbers
// may submit as strings; the API coerces them against the same model on save.
export function OverlayWidgetForm({
  model, value, onSubmit,
}: {
  model: string
  value: Record<string, unknown>
  onSubmit: (widget: Record<string, unknown>) => void
}) {
  const zodModel = getOverlayModel(model)
  const { control, handleSubmit } = useForm({
    resolver: zodModel ? zodResolver(zodModel as never) : undefined,
    defaultValues: value,
  })

  return (
    <Box component="form"
      onSubmit={handleSubmit((d) => onSubmit(d as Record<string, unknown>))}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <OverlayWidgetFields model={model}
        control={control} />
      <Button type="submit"
        variant="outlined">
        Save fields
      </Button>
    </Box>
  )
}
