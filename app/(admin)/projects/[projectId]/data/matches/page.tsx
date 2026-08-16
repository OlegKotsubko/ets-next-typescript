'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { matchesApi } from '@/store/apis/matchesApi'
import { matchesEntityDef } from '@/lib/entities/matches'

export default function MatchesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId}
    entityDef={matchesEntityDef}
    api={matchesApi} />
}
