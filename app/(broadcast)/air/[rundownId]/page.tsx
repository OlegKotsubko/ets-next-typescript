'use client'

import { use } from 'react'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'
import { usePackageLabel } from '@/lib/broadcast/PackageLabelContext'

export default function AirPage({ params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = use(params)
  const packageLabel = usePackageLabel()
  const titles = useTitleStream(rundownId, 'air')
  return <TitleRenderer titles={titles}
    packageLabel={packageLabel} />
}
