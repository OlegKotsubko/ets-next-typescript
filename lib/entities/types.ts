import type { ZodTypeAny } from 'zod'

export type FieldDef = {
  name: string
  label: string
  widget: 'text' | 'textarea' | 'select' | 'asset-picker' | 'extra-map'
  options?: { value: string; label: string }[]
}

export type EntityDef<TRow> = {
  entityName: string
  fields: FieldDef[]
  createSchema: ZodTypeAny
  columns: { field: keyof TRow & string; headerName: string }[]
}
