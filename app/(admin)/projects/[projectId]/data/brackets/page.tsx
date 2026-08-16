'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { bracketsApi } from '@/store/apis/bracketsApi'
import { bracketsEntityDef } from '@/lib/entities/brackets'

export default function BracketsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId}
    entityDef={bracketsEntityDef}
    api={bracketsApi} />
}
