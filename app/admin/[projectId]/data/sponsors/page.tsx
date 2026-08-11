'use client'
import { use } from 'react'
import { CrudPage } from '@/components/admin/crud/CrudPage'
import { sponsorsApi } from '@/store/apis/sponsorsApi'
import { sponsorsEntityDef } from '@/lib/entities/sponsors'

export default function SponsorsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  return <CrudPage projectId={projectId}
    entityDef={sponsorsEntityDef}
    api={sponsorsApi} />
}
