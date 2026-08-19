'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { teamsApi } from '@/store/apis/teamsApi'
import { teamsEntityDef } from '@/lib/entities/teams'

export default function TeamsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId}
    entityDef={teamsEntityDef}
    api={teamsApi} />
}
