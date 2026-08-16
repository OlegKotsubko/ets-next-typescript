'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { assetsApi } from '@/store/apis/assetsApi'
import { assetsEntityDef } from '@/lib/entities/assets'

export default function AssetsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId}
    entityDef={assetsEntityDef}
    api={assetsApi} />
}
