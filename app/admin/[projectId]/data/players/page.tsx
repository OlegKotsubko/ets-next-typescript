'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { playersApi } from '@/store/apis/playersApi'
import { playersEntityDef } from '@/lib/entities/players'

export default function PlayersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId} entityDef={playersEntityDef} api={playersApi} />
}
