'use client'
import { useState } from 'react'
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { EntityDef } from '@/lib/entities/types'
import { AssetPickerField } from './AssetPickerField'

type EntityApi = Record<string, any>

export function CrudPage<TRow extends { id: string }>({
  projectId, entityDef, api,
}: {
  projectId: string
  entityDef: EntityDef<TRow>
  api: EntityApi
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TRow | null>(null)

  const listHookName = `useList${entityDef.entityName}sQuery`
  const createHookName = `useCreate${entityDef.entityName}Mutation`
  const updateHookName = `useUpdate${entityDef.entityName}Mutation`
  const deleteHookName = `useDelete${entityDef.entityName}Mutation`

  type Mutate<TArgs> = () => [(args: TArgs) => Promise<unknown>, unknown]

  const useListQuery = api[listHookName] as (projectId: string) => { data?: TRow[] }
  const useCreateMutation = api[createHookName] as Mutate<{ projectId: string; data: unknown }>
  const useUpdateMutation = api[updateHookName] as Mutate<{ projectId: string; id: string; data: unknown }>
  const useDeleteMutation = api[deleteHookName] as Mutate<{ projectId: string; id: string }>

  const { data: rows = [] } = useListQuery(projectId)
  const [createRow] = useCreateMutation()
  const [updateRow] = useUpdateMutation()
  const [deleteRow] = useDeleteMutation()

  const { control, handleSubmit, reset } = useForm({ resolver: zodResolver(entityDef.createSchema) })

  function openCreate() {
    setEditing(null)
    reset({})
    setOpen(true)
  }

  function openEdit(row: TRow) {
    setEditing(row)
    reset(row)
    setOpen(true)
  }

  async function onSubmit(data: Record<string, unknown>) {
    if (editing) await updateRow({ projectId, id: editing.id, data })
    else await createRow({ projectId, data })
    setOpen(false)
  }

  const columns: GridColDef[] = [
    ...entityDef.columns.map((c) => ({ field: c.field, headerName: c.headerName, flex: 1 })),
    {
      field: '__actions',
      headerName: '',
      sortable: false,
      renderCell: (params) => (
        <>
          <Button size="small"
            onClick={() => openEdit(params.row as TRow)}>
Edit
          </Button>
          <Button size="small"
            color="error"
            onClick={() => deleteRow({ projectId, id: (params.row as TRow).id })}>
Delete
          </Button>
        </>
      ),
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">
          {entityDef.entityName}
s
        </Typography>
        <Button variant="contained"
          onClick={openCreate}>
          {`Add ${entityDef.entityName}`}
        </Button>
      </Box>
      <DataGrid rows={rows}
        columns={columns}
        getRowId={(r) => (r as TRow).id}
        autoHeight />
      <Dialog open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm">
        <DialogTitle>
          {editing ? `Edit ${entityDef.entityName}` : `Add ${entityDef.entityName}`}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entityDef.fields.map((field) => (
              <Controller
                key={field.name}
                name={field.name}
                control={control}
                render={({ field: rhf, fieldState }) => {
                  if (field.widget === 'select') {
                    return (
                      <TextField
                        select
                        label={field.label}
                        value={rhf.value ?? ''}
                        onChange={rhf.onChange}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      >
                        {field.options?.map((o) => <MenuItem key={o.value}
                          value={o.value}>
                          {o.label}
                        </MenuItem>)}
                      </TextField>
                    )
                  }
                  if (field.widget === 'asset-picker') {
                    return <AssetPickerField projectId={projectId}
                      value={rhf.value ?? null}
                      onChange={rhf.onChange}
                      kind="other" />
                  }
                  return (
                    <TextField
                      label={field.label}
                      value={rhf.value ?? ''}
                      onChange={rhf.onChange}
                      multiline={field.widget === 'textarea'}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )
                }}
              />
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>
Cancel
            </Button>
            <Button type="submit"
              variant="contained">
Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
