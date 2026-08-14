'use client'
import { useState } from 'react'
import {
  Box, Stack, Typography, IconButton, Collapse, Paper,
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import type { RundownItem } from '@/lib/entities/rundown-items'
import type { TitleOption } from '@/lib/titles/listTitleOptions'
import { TitleDataForm } from './TitleDataForm'

const COLOR_HEX: Record<string, string> = { red: '#e53935', green: '#43a047', blue: '#1e88e5', yellow: '#fdd835' }

type SaveResult = { fieldErrors?: Record<string, string[]> } | void

// Prop-driven: the page owns the RTK hooks and passes callbacks. `option` is the
// item's title (from the titles endpoint); it may be missing if the package no
// longer defines that titleKey, in which case the data form is unavailable.
export function RundownItemRow({
  item, option, isFirst, isLast, onReorderUp, onReorderDown, onDelete, onSaveData, saving,
}: {
  item: RundownItem
  option?: TitleOption
  isFirst: boolean
  isLast: boolean
  onReorderUp: () => void
  onReorderDown: () => void
  onDelete: () => void
  onSaveData: (_values: Record<string, unknown>) => Promise<SaveResult>
  saving?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const name = option?.name ?? item.titleKey
  const color = option?.color

  return (
    <Paper variant="outlined"
      sx={{ p: 1.5 }}>
      <Stack direction="row"
        spacing={1}
        alignItems="center">
        {color && (
          <Box component="span"
            aria-label={`color ${color}`}
            sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: COLOR_HEX[color] ?? color, flexShrink: 0 }} />
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography noWrap>
            {name}
          </Typography>
          {item.label && (
            <Typography variant="body2"
              color="text.secondary"
              noWrap>
              {item.label}
            </Typography>
          )}
        </Box>
        <IconButton size="small"
          aria-label="Move up"
          disabled={isFirst}
          onClick={onReorderUp}>
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton size="small"
          aria-label="Move down"
          disabled={isLast}
          onClick={onReorderDown}>
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        <IconButton size="small"
          aria-label="Edit data"
          disabled={!option}
          onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small"
          aria-label="Delete item"
          onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
      {option && (
        <Collapse in={expanded}
          unmountOnExit>
          <Box sx={{ pt: 2 }}>
            <TitleDataForm
              fields={option.fields}
              defaultValues={{ ...option.defaults, ...item.data }}
              onSubmit={onSaveData}
              saving={saving}
            />
          </Box>
        </Collapse>
      )}
    </Paper>
  )
}
