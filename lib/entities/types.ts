import type { ZodTypeAny } from 'zod'

export type FieldDef = {
  name: string
  label: string
  widget: 'text' | 'textarea' | 'select' | 'social-links' | 'typed-images' | 'roster' | 'asset-picker'
  options?: { value: string; label: string }[]
  photoTypes?: string[] // for the 'typed-images' widget
}

export type EntityDef<TRow> = {
  entityName: string
  fields: FieldDef[]
  createSchema: ZodTypeAny
  columns: { field: keyof TRow & string; headerName: string }[]
}
