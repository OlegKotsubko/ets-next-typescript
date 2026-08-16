import type { ZodTypeAny } from 'zod'

export type FieldDef = {
  name: string
  label: string
  widget: 'text' | 'textarea' | 'select' | 'social-links' | 'typed-images' | 'asset-picker'
  options?: { value: string; label: string }[]
  optionsFrom?: 'tags' // resolved at the page level via withTagOptions()
  photoTypes?: string[] // for the 'typed-images' widget
}

export type EntityDef<TRow> = {
  entityName: string
  fields: FieldDef[]
  createSchema: ZodTypeAny
  columns: { field: keyof TRow & string; headerName: string }[]
}

// Discipline selects reference the GLOBAL tags vocabulary; the entity page loads
// tags (useListTagsQuery) and injects them so CrudPage stays free of tagsApi.
export function withTagOptions<T>(
  def: EntityDef<T>,
  tags: { id: number; name: string }[],
): EntityDef<T> {
  return {
    ...def,
    fields: def.fields.map((f) => (
      f.optionsFrom === 'tags'
        ? { ...f, options: tags.map((t) => ({ value: String(t.id), label: t.name })) }
        : f
    )),
  }
}
