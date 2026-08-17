import {
  Box, Card, CardActionArea, CardContent, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import type { CatalogEntry } from '@/lib/overlays/types'
import { OverlayThumbnail } from './OverlayThumbnail'

function firstPreview(preview?: Record<string, string>): string | undefined {
  if (!preview) return undefined
  return Object.values(preview)[0]
}

export function OverlayTemplateGrid({
  entries, onPick,
}: {
  entries: CatalogEntry[]
  onPick: (model: string) => void
}) {
  return (
    <Box>
      <Typography variant="h6"
        sx={{ mb: 2 }}>
        Select a template
      </Typography>
      <Grid container
        spacing={2}>
        {entries.map((e) => (
          <Grid key={e.model}
            size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardActionArea onClick={() => onPick(e.model)}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <OverlayThumbnail src={firstPreview(e.preview)}
                    label={e.category} />
                  <Typography variant="subtitle2">
                    {e.widgetName}
                  </Typography>
                  <Typography variant="caption"
                    color="text.secondary">
                    {e.category}
                    {e.isFullscreen ? ' · full-screen' : ''}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
