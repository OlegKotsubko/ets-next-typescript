// Parses the error shapes RTK Query mutations reject with: an unwrapped
// fetchBaseQuery error (`{ data: { message | error } }` or `{ data: string }`)
// or a plain `{ message }` / `{ error }` object.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    if ('data' in err) {
      const data = (err as { data?: unknown }).data
      if (data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string') {
        return (data as { message: string }).message
      }
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
        return (data as { error: string }).error
      }
      if (typeof data === 'string') return data
    }
    if ('error' in err && typeof (err as { error?: unknown }).error === 'string') {
      return (err as { error: string }).error
    }
    if ('message' in err && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message
    }
  }
  return fallback
}
