'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { playersApi } from '@/store/apis/playersApi'
import { playersEntityDef } from '@/lib/entities/players'
import { withTagOptions } from '@/lib/entities/types'
import { useListTagsQuery } from '@/store/apis/tagsApi'

export default function PlayersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: tags = [] } = useListTagsQuery()
  return <CrudPage projectId={projectId}
    entityDef={withTagOptions(playersEntityDef, tags)}
    api={playersApi} />
}
