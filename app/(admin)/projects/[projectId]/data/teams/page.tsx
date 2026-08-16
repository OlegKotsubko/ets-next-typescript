'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { teamsApi } from '@/store/apis/teamsApi'
import { teamsEntityDef } from '@/lib/entities/teams'
import { withTagOptions } from '@/lib/entities/types'
import { useListTagsQuery } from '@/store/apis/tagsApi'

export default function TeamsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: tags = [] } = useListTagsQuery()
  return <CrudPage projectId={projectId}
    entityDef={withTagOptions(teamsEntityDef, tags)}
    api={teamsApi} />
}
