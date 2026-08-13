'use client'

import { use } from 'react'
import { useTitleStream } from '@/lib/broadcast/useTitleStream'
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer'
import { usePackageLabel } from '@/lib/broadcast/PackageLabelContext'

export default function PreviewPage({ params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = use(params)
  const packageLabel = usePackageLabel()
  const titles = useTitleStream(rundownId, 'preview')
  return <TitleRenderer titles={titles}
    packageLabel={packageLabel} />
}
