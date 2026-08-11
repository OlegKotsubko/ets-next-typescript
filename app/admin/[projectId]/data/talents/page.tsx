'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { talentsApi } from '@/store/apis/talentsApi'
import { talentsEntityDef } from '@/lib/entities/talents'

export default function TalentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId} entityDef={talentsEntityDef} api={talentsApi} />
}
