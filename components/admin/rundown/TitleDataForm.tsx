'use client'
import { useForm, Controller, type Control } from 'react-hook-form'
import {
  Box, Stack, TextField, MenuItem, Checkbox, FormControlLabel, Button, IconButton,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import type { FieldDescriptor } from '@/lib/titles/describeModel'

type Values = Record<string, unknown>
type SubmitResult = { fieldErrors?: Record<string, string[]> } | void

// A minimal add/remove list of text inputs for array<string> fields.
function StringArrayField({ value, onChange }: { value: string[]; onChange: (_next: string[]) => void }) {
  const items = Array.isArray(value) ? value : []
  return (
    <Box>
      <Stack spacing={1}>
        {items.map((v, i) => (
          <Stack direction="row"
            spacing={1}
            key={i}
            alignItems="center">
            <TextField size="small"
              value={v}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <IconButton aria-label="remove item"
              onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small"
        onClick={() => onChange([...items, ''])}
        sx={{ mt: 1 }}>
        Add item
      </Button>
    </Box>
  )
}

function renderField(f: FieldDescriptor, control: Control<Values>) {
  return (
    <Controller
      key={f.name}
      name={f.name}
      control={control}
      render={({ field: rhf, fieldState }) => {
        const error = !!fieldState.error
        const helperText = fieldState.error?.message
        if (f.kind === 'enum') {
          return (
            <TextField select
              label={f.label}
              value={rhf.value ?? ''}
              onChange={rhf.onChange}
              error={error}
              helperText={helperText}>
              {f.options.map((o) => <MenuItem key={o}
                value={o}>
                {o}
              </MenuItem>)}
            </TextField>
          )
        }
        if (f.kind === 'boolean') {
          return (
            <FormControlLabel
              label={f.label}
              control={<Checkbox checked={!!rhf.value}
                onChange={(e) => rhf.onChange(e.target.checked)} />}
            />
          )
        }
        if (f.kind === 'number') {
          return (
            <TextField type="number"
              label={f.label}
              value={rhf.value ?? ''}
              onChange={(e) => rhf.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              error={error}
              helperText={helperText} />
          )
        }
        if (f.kind === 'stringArray') {
          return (
            <Box>
              <Box sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                {f.label}
              </Box>
              <StringArrayField value={(rhf.value as string[]) ?? []}
                onChange={rhf.onChange} />
            </Box>
          )
        }
        return (
          <TextField label={f.label}
            value={rhf.value ?? ''}
            onChange={rhf.onChange}
            multiline={f.multiline}
            error={error}
            helperText={helperText} />
        )
      }}
    />
  )
}

// Descriptor-driven data form. Prop-driven and store-free: the parent supplies
// fields (from the title's model.ts via describeModel), default values, and an
// onSubmit that persists. When onSubmit returns { fieldErrors } (a server 400),
// they are mapped onto the fields as badges — the server model is authoritative.
export function TitleDataForm({
  fields, defaultValues, onSubmit, saving,
}: {
  fields: FieldDescriptor[]
  defaultValues: Values
  onSubmit: (_values: Values) => Promise<SubmitResult>
  saving?: boolean
}) {
  const { control, handleSubmit, setError } = useForm<Values>({ defaultValues })

  async function submit(values: Values) {
    const result = await onSubmit(values)
    if (result && result.fieldErrors) {
      for (const [name, msgs] of Object.entries(result.fieldErrors)) {
        setError(name, { message: msgs.join(', ') })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Stack spacing={2}>
        {fields.map((f) => renderField(f, control))}
        <Box>
          <Button type="submit"
            variant="contained"
            disabled={saving}>
            Save
          </Button>
        </Box>
      </Stack>
    </form>
  )
}
