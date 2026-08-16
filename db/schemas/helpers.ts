import { z } from 'zod'

// MUI selects submit option values as strings, and empty fields submit ''.
// These coerce form input into the DB shape: '' → undefined, '5' → 5.
export const optionalId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().optional(),
)

export const optionalDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().date().optional(),
)
