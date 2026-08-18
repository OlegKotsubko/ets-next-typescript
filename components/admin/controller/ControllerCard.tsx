'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box, Button, Card, Chip, Collapse, IconButton, Typography, Tooltip,
} from '@mui/material'
import CreateIcon from '@mui/icons-material/Create'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'
import {
  usePreviewMutation, useHideMutation, useLiveUpdateMutation,
} from '@/store/apis/broadcastApi'
import { describeModel, getOverlayModel } from '@/lib/overlays/catalog'
import { overlayColor } from '@/components/admin/overlays/overlayColors'
import { OverlayThumbnail } from '@/components/admin/overlays/OverlayThumbnail'
import { OverlayWidgetFields } from '@/components/admin/overlays/OverlayWidgetFields'

// Port of etalon ControllerCard + useWidget. Live state (staged / on-air) is
// derived from the rundown's SSE sets, not a persisted flag. The card owns one
// RHF form, so Stage / Live-update always submit the operator's CURRENT field
// values (etalon: the Preview button IS the form submit).
export function ControllerCard({
  overlay, projectId, rundownId, isPreview, isAir,
}: {
  overlay: RundownOverlay
  projectId: string
  rundownId: string | number
  isPreview: boolean
  isAir: boolean
}) {
  const [open, setOpen] = useState(false)
  const [preview] = usePreviewMutation()
  const [hide] = useHideMutation()
  const [liveUpdate] = useLiveUpdateMutation()
  const ctx = { projectId, rundownId }

  // Live-update only applies to models that declare at least one such field.
  const hasLiveField = describeModel(overlay.model).some((f) => f.can_live_update)
  const zodModel = getOverlayModel(overlay.model)
  const { control, handleSubmit } = useForm({
    resolver: zodModel ? zodResolver(zodModel as never) : undefined,
    defaultValues: overlay.data.widget,
  })

  // Stage the current field values to preview (validates + persists server-side).
  const stage = handleSubmit((values) => {
    preview({ ...ctx, overlayId: overlay.id, widget: values as Record<string, unknown> })
  })
  // Etalon toggle: staging when idle, hiding from preview when already staged.
  const onStageToggle = () => {
    if (isPreview) hide({ ...ctx, overlayId: overlay.id, channel: 'preview' })
    else stage()
  }
  // Push the current field values to whatever is already on air (live_update).
  const onLive = handleSubmit((values) => {
    liveUpdate({ ...ctx, overlayId: overlay.id, widget: values as Record<string, unknown> })
  })

  async function hideEverything() {
    await hide({ ...ctx, overlayId: overlay.id, channel: 'air' })
    await hide({ ...ctx, overlayId: overlay.id, channel: 'preview' })
  }

  return (
    <Card sx={{
      position: 'relative',
      borderRadius: 1,
      overflow: 'hidden',
      border: '2px solid',
      borderColor: isAir ? 'error.main' : isPreview ? 'secondary.main' : 'transparent',
    }}>
      <Box sx={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: overlayColor(overlay.color),
      }} />
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: 1, pl: 2,
      }}>
        <IconButton size="small"
          aria-label={open ? 'Close fields' : 'Edit fields'}
          onClick={() => setOpen((v) => !v)}>
          {open ? <CloseIcon /> : <CreateIcon />}
        </IconButton>
        <OverlayThumbnail src={overlay.previewImg}
          label={overlay.category ?? overlay.model}
          width={96}
          height={54} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1"
            noWrap>
            {overlay.widgetName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small"
              label={overlay.category ?? overlay.model} />
            <Chip size="small"
              label={`L${overlay.layer}`} />
            {overlay.displayFilter ? (
              <Chip size="small"
                label={`display ${overlay.displayFilter}`} />
            ) : null}
          </Box>
        </Box>
        <Tooltip title={isPreview ? 'Hide from preview' : 'Stage to preview'}>
          <IconButton aria-label={isPreview ? 'Hide from preview' : 'Stage to preview'}
            onClick={onStageToggle}
            sx={{
              bgcolor: isPreview ? 'secondary.main' : 'action.selected',
              '&:hover': { bgcolor: isPreview ? 'secondary.dark' : 'action.hover' },
            }}>
            <VisibilityIcon />
          </IconButton>
        </Tooltip>
        {isAir ? (
          <Tooltip title="Hide (air + preview)">
            <IconButton aria-label="Hide"
              onClick={hideEverything}
              sx={{ bgcolor: 'warning.main', '&:hover': { bgcolor: 'warning.dark' } }}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>
          <OverlayWidgetFields model={overlay.model}
            control={control} />
          {hasLiveField ? (
            <Button variant="contained"
              size="small"
              sx={{ mt: 2 }}
              disabled={!(isPreview || isAir)}
              onClick={onLive}>
              Update
            </Button>
          ) : null}
        </Box>
      </Collapse>
    </Card>
  )
}
