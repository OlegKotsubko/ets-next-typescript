import { z } from 'zod'

export type InputType = 'text' | 'number' | 'select' | 'selectmulti' | 'checkbox' | 'list_object'

export type FieldDescriptor = {
  name: string
  input_type: InputType
  label: string
  required: boolean
  default?: unknown
  choices?: [value: string, label: string][]
  can_live_update: boolean
}

type FieldSpec = { zod: z.ZodTypeAny; descriptor: Omit<FieldDescriptor, 'name'> }
type Common = { label?: string; required?: boolean; canLiveUpdate?: boolean }

function base(input_type: InputType, o: Common, extra: Partial<FieldDescriptor> = {}): Omit<FieldDescriptor, 'name'> {
  return {
    input_type,
    label: o.label ?? '',
    required: o.required ?? false,
    can_live_update: o.canLiveUpdate ?? false,
    ...extra,
  }
}

// default present → .default(); optional (not required) → .optional(); else bare (required).
function withPresence(zod: z.ZodTypeAny, o: Common & { default?: unknown }): z.ZodTypeAny {
  if (o.default !== undefined) return zod.default(o.default as never)
  if (!o.required) return zod.optional()
  return zod
}

export function text(o: Common & { default?: string } = {}): FieldSpec {
  return { zod: withPresence(z.string(), o), descriptor: base('text', o, { default: o.default }) }
}
export function number(o: Common & { default?: number } = {}): FieldSpec {
  return { zod: withPresence(z.coerce.number(), o), descriptor: base('number', o, { default: o.default }) }
}
export function checkbox(o: Common & { default?: boolean } = {}): FieldSpec {
  // z.boolean() (not coerce) — coercion would turn the string "false" into true.
  return { zod: withPresence(z.boolean(), o), descriptor: base('checkbox', o, { default: o.default }) }
}
export function select(o: Common & { choices: [string, string][]; default?: string }): FieldSpec {
  const values = o.choices.map((c) => c[0]) as [string, ...string[]]
  return { zod: withPresence(z.enum(values), o), descriptor: base('select', o, { default: o.default, choices: o.choices }) }
}
export function selectMulti(o: Common & { choices: [string, string][]; default?: string[] }): FieldSpec {
  const values = o.choices.map((c) => c[0]) as [string, ...string[]]
  return { zod: withPresence(z.array(z.enum(values)), o), descriptor: base('selectmulti', o, { default: o.default, choices: o.choices }) }
}
export function listObject(o: Common & { fields: Record<string, FieldSpec>; default?: unknown[] }): FieldSpec {
  const shape = Object.fromEntries(Object.entries(o.fields).map(([k, v]) => [k, v.zod]))
  return { zod: withPresence(z.array(z.object(shape)), o), descriptor: base('list_object', o, { default: o.default }) }
}

function humanize(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

export function defineWidget<S extends Record<string, FieldSpec>>(shape: S) {
  const zodShape: Record<string, z.ZodTypeAny> = {}
  const fields: FieldDescriptor[] = []
  for (const [name, spec] of Object.entries(shape)) {
    zodShape[name] = spec.zod
    fields.push({ name, ...spec.descriptor, label: spec.descriptor.label || humanize(name) })
  }
  return { model: z.object(zodShape), fields }
}
