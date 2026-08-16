'use client'
import { Box, TextField, Typography } from '@mui/material'

type Photo = { photoType: string; url: string }

// One URL input per photo type; value is an array of non-empty { photoType, url }.
export function TypedImagesField({
  photoTypes, value, onChange, label = 'Images',
}: {
  photoTypes: string[]
  value: Photo[]
  onChange: (next: Photo[]) => void
  label?: string
}) {
  const byType = new Map((value ?? []).map((p) => [p.photoType, p.url]))

  function setUrl(photoType: string, url: string) {
    const next = new Map(byType)
    if (url.trim()) next.set(photoType, url)
    else next.delete(photoType)
    onChange([...next.entries()].map(([photoType, url]) => ({ photoType, url })))
  }

  return (
    <Box>
      <Typography variant="caption"
        color="text.secondary">
        {label}
      </Typography>
      {photoTypes.map((pt) => (
        <TextField key={pt}
          size="small"
          fullWidth
          label={pt}
          value={byType.get(pt) ?? ''}
          onChange={(e) => setUrl(pt, e.target.value)}
          sx={{ mt: 1 }} />
      ))}
    </Box>
  )
}
