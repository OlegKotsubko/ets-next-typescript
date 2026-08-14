import { z } from 'zod'

// A plain-JSON description of one operator-editable field, derived from a title's
// Zod model.ts. Serialized to the client so the data form can render inputs
// without holding the Zod schema (the real model validates server-side).
export type FieldDescriptor =
  | { name: string; label: string; kind: 'string'; required: boolean; minLength?: number; maxLength?: number; multiline: boolean }
  | { name: string; label: string; kind: 'number'; required: boolean; int: boolean; min?: number; max?: number }
  | { name: string; label: string; kind: 'enum'; required: boolean; options: string[] }
  | { name: string; label: string; kind: 'boolean'; required: boolean }
  | { name: string; label: string; kind: 'stringArray'; required: boolean }

const WRAPPERS = new Set(['ZodOptional', 'ZodDefault', 'ZodNullable'])

function humanize(name: string): string {
  const s = name.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Zod internals are untyped; this module reads _def deliberately (see the
// describeModel tests, which are the oracle for the shape).
function unwrap(field: any): any {
  let inner = field
  while (inner?._def && WRAPPERS.has(inner._def.typeName)) inner = inner._def.innerType
  return inner
}

function checkValue(inner: any, kind: string): number | undefined {
  const c = (inner._def.checks ?? []).find((x: any) => x.kind === kind)
  return c ? c.value : undefined
}

export function describeModel(model: z.ZodTypeAny): FieldDescriptor[] {
  const shape = (model as any).shape as Record<string, z.ZodTypeAny> | undefined
  if (!shape) return []
  const out: FieldDescriptor[] = []
  for (const [name, field] of Object.entries(shape)) {
    const required = !WRAPPERS.has((field as any)._def.typeName)
    const inner = unwrap(field)
    const label = humanize(name)
    const tn = inner._def.typeName
    if (tn === 'ZodString') {
      const maxLength = checkValue(inner, 'max')
      out.push({
        name, label, kind: 'string', required,
        minLength: checkValue(inner, 'min'), maxLength,
        multiline: maxLength === undefined || maxLength > 60,
      })
    } else if (tn === 'ZodNumber') {
      const int = (inner._def.checks ?? []).some((c: any) => c.kind === 'int')
      out.push({ name, label, kind: 'number', required, int, min: checkValue(inner, 'min'), max: checkValue(inner, 'max') })
    } else if (tn === 'ZodEnum') {
      out.push({ name, label, kind: 'enum', required, options: [...inner._def.values] })
    } else if (tn === 'ZodBoolean') {
      out.push({ name, label, kind: 'boolean', required })
    } else if (tn === 'ZodArray' && inner._def.type?._def?.typeName === 'ZodString') {
      out.push({ name, label, kind: 'stringArray', required })
    }
    // Unsupported kinds are skipped — out of P5a scope.
  }
  return out
}

function fallback(f: FieldDescriptor): unknown {
  switch (f.kind) {
    case 'string': return ''
    case 'number': return f.min ?? 0
    case 'enum': return f.options[0] ?? ''
    case 'boolean': return false
    case 'stringArray': return []
  }
}

// Every described field gets a controlled starting value, so a freshly-added
// item is immediately editable and its inputs are controlled from first render.
export function computeDefaults(model: z.ZodTypeAny): Record<string, unknown> {
  const parsed = model.safeParse({})
  const base: Record<string, unknown> = parsed.success ? { ...(parsed.data as object) } : {}
  for (const f of describeModel(model)) {
    if (base[f.name] === undefined) base[f.name] = fallback(f)
  }
  return base
}
