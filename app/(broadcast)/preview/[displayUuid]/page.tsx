'use client'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBroadcastChannel } from '@/lib/broadcast/useBroadcastChannel'
import { OverlayCanvas } from '@/components/broadcast/OverlayCanvas'

export default function PreviewPage({ params }: { params: Promise<{ displayUuid: string }> }) {
  const { displayUuid } = use(params)
  const filter = useSearchParams().get('filter')
  const overlays = useBroadcastChannel(displayUuid, 'preview', filter)
  return <OverlayCanvas overlays={overlays} />
}
