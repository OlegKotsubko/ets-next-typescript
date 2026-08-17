import { Box } from '@mui/material'

export function OverlayThumbnail({
  src, label, width = 128, height = 72,
}: {
  src?: string | null
  label: string
  width?: number
  height?: number
}) {
  if (src) {
    return (
      <Box component="img"
        src={src}
        alt={label}
        sx={{ width, height, objectFit: 'cover', borderRadius: 1, display: 'block' }} />
    )
  }
  return (
    <Box sx={{
      width,
      height,
      borderRadius: 1,
      border: '1px dashed',
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'text.secondary',
      fontSize: 11,
      textAlign: 'center',
      px: 0.5,
    }}>
      {label}
    </Box>
  )
}
