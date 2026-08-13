'use client'

import { useEffect, useRef, useState } from 'react'
import { applyEvent, sortLiveSet, type LiveTitle, type BroadcastEvent } from './liveSet'

export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[] {
  const [titles, setTitles] = useState<LiveTitle[]>([])
  const mapRef = useRef<Map<string, LiveTitle>>(new Map())

  useEffect(() => {
    mapRef.current = new Map()
    setTitles([])
    const es = new EventSource(`/api/broadcast/${rundownId}/stream?channel=${channel}`)
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as BroadcastEvent
      mapRef.current = applyEvent(mapRef.current, event)
      setTitles(sortLiveSet(mapRef.current))
    }
    // EventSource auto-reconnects on network drop; no manual retry needed.
    return () => es.close()
  }, [rundownId, channel])

  return titles
}
