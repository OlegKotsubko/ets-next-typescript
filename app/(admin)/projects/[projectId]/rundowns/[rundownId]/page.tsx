'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { Box, Button, Card, Typography } from '@mui/material'
import { listOverlays } from '@/lib/overlays/catalog'
import { useGetProjectQuery } from '@/store/apis/projectsApi'
import { useListTagsQuery } from '@/store/apis/tagsApi'
import { useGetRundownQuery } from '@/store/apis/rundownsApi'
import {
  useListRundownOverlaysQuery, useCreateRundownOverlayMutation, useUpdateRundownOverlayMutation,
  useDeleteRundownOverlayMutation, useReorderRundownOverlaysMutation, type RundownOverlay,
} from '@/store/apis/rundownOverlaysApi'
import { RundownOverlayListing } from '@/components/admin/overlays/RundownOverlayListing'
import { OverlayTemplateGrid } from '@/components/admin/overlays/OverlayTemplateGrid'
import { OverlayPropertiesForm } from '@/components/admin/overlays/OverlayPropertiesForm'

export default function RundownEditorPage({ params }: { params: Promise<{ projectId: string; rundownId: string }> }) {
  const { projectId, rundownId } = use(params)
  const { data: project } = useGetProjectQuery(projectId)
  const { data: tags = [] } = useListTagsQuery()
  const { data: rundown } = useGetRundownQuery({ projectId, id: Number(rundownId) })
  const { data: overlays = [] } = useListRundownOverlaysQuery({ projectId, rundownId })
  const [createOverlay] = useCreateRundownOverlayMutation()
  const [updateOverlay] = useUpdateRundownOverlayMutation()
  const [deleteOverlay] = useDeleteRundownOverlayMutation()
  const [reorderOverlays] = useReorderRundownOverlaysMutation()

  const disciplineName = tags.find((t) => t.id === project?.disciplineId)?.name
  const catalog = listOverlays(disciplineName)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeColors, setActiveColors] = useState<Set<number>>(new Set())
  const selected = overlays.find((o) => o.id === selectedId) ?? null

  function toggleColor(color: number) {
    setActiveColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }
  async function add(model: string) {
    const created = await createOverlay({ projectId, rundownId, data: { model } }).unwrap()
    setSelectedId(created.id)
  }
  function saveSettings(o: RundownOverlay, patch: Partial<RundownOverlay>) {
    updateOverlay({ projectId, rundownId, overlayId: o.id, data: patch as Record<string, unknown> })
  }
  function saveWidget(o: RundownOverlay, widget: Record<string, unknown>) {
    updateOverlay({ projectId, rundownId, overlayId: o.id, data: { widget } })
  }
  async function remove(id: number) {
    await deleteOverlay({ projectId, rundownId, overlayId: id })
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  return (
    <Box sx={{ p: 4 }}>
      <Button component={Link}
        href={`/projects/${projectId}/rundowns`}
        size="small"
        sx={{ mb: 1 }}>
        ← Rundowns
      </Button>
      <Typography variant="h4"
        sx={{ mb: 3 }}>
        {rundown?.name ?? 'Rundown'}
      </Typography>
      <Box sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: '440px 1fr' },
        alignItems: 'start',
      }}>
        <RundownOverlayListing overlays={overlays}
          activeColors={activeColors}
          selectedId={selectedId}
          onToggleColor={toggleColor}
          onSelect={setSelectedId}
          onReorder={(orderedIds) => reorderOverlays({ projectId, rundownId, orderedIds })}
          onDelete={remove}
          onAdd={() => setSelectedId(null)} />
        <Card sx={{ p: 3 }}>
          {selected ? (
            <OverlayPropertiesForm key={selected.id}
              overlay={selected}
              onSaveSettings={(patch) => saveSettings(selected, patch)}
              onSaveWidget={(widget) => saveWidget(selected, widget)}
              onDelete={() => remove(selected.id)} />
          ) : (
            <OverlayTemplateGrid entries={catalog}
              onPick={add} />
          )}
        </Card>
      </Box>
    </Box>
  )
}
