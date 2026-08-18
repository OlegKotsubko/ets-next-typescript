'use client'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBroadcastChannel } from '@/lib/broadcast/useBroadcastChannel'
import { OverlayCanvas } from '@/components/broadcast/OverlayCanvas'

export default function AirPage({ params }: { params: Promise<{ rundownUuid: string }> }) {
  const { rundownUuid } = use(params)
  const filter = useSearchParams().get('filter')
  const overlays = useBroadcastChannel(rundownUuid, 'air', filter)
  return <OverlayCanvas overlays={overlays} />
}
