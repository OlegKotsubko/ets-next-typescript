'use client'
import { useState } from 'react'
import { MenuItem, TextField, Button, Stack } from '@mui/material'
import { useListAssetsQuery } from '@/store/apis/assetsApi'

export function AssetPickerField({
  projectId, value, onChange, kind,
}: {
  projectId: string
  value: number | null
  onChange: (_assetId: number | null) => void
  kind: string
}) {
  const { data: assets = [] } = useListAssetsQuery(projectId)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kind)
    const res = await fetch(`/api/projects/${projectId}/assets/upload`, { method: 'POST', body: formData })
    const row = await res.json()
    setUploading(false)
    onChange(row.id)
  }

  return (
    <Stack direction="row"
      spacing={1}
      alignItems="center">
      <TextField
        select
        size="small"
        label="Asset"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">
None
        </MenuItem>
        {assets.map((a: { id: number; name: string }) => (
          <MenuItem key={a.id}
            value={a.id}>
            {a.name}
          </MenuItem>
        ))}
      </TextField>
      <Button component="label"
        disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload'}
        <input type="file"
          hidden
          onChange={handleUpload}
          accept="image/*,video/*" />
      </Button>
    </Stack>
  )
}
