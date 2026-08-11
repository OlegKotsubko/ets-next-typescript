'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { videosApi } from '@/store/apis/videosApi'
import { videosEntityDef } from '@/lib/entities/videos'

export default function VideosPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId} entityDef={videosEntityDef} api={videosApi} />
}
