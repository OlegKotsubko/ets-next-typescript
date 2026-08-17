'use client'
import { useEffect, useRef } from 'react'
import { getOverlayRender } from '@/lib/overlays/render'
import type { OverlayPayload } from '@/lib/broadcast/types'

function OverlayHost({ overlay }: { overlay: OverlayPayload }) {
  const ref = useRef<HTMLDivElement>(null)
  const entry = getOverlayRender(overlay.model)
  useEffect(() => {
    if (ref.current && entry) entry.animationIn(ref.current)
  }, [entry])
  if (!entry) return null
  const { Component } = entry
  return (
    <div ref={ref}
      style={{ position: 'absolute', inset: 0, zIndex: overlay.layer }}>
      <Component data={overlay.data} />
    </div>
  )
}

export function OverlayCanvas({ overlays }: { overlays: OverlayPayload[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, width: 1920, height: 1080, overflow: 'hidden' }}>
      {overlays.map((o) => <OverlayHost key={o.id}
        overlay={o} />)}
    </div>
  )
}
