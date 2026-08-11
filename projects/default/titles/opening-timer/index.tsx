'use client'

import { useEffect, useState } from 'react'
import type { TitleProps } from '@/lib/titles/types'
import type { Data } from './model'
import styles from './OpeningTimer.module.scss'

function toSeconds(data: Data) {
  return data.hours * 3600 + data.minutes * 60 + data.seconds
}

function format(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function OpeningTimer({ data, onCommand }: TitleProps<Data>) {
  const initial = toSeconds(data)
  const [remaining, setRemaining] = useState(initial)
  const [running, setRunning] = useState(false)
  const [seenData, setSeenData] = useState(data)

  // Adjusting state during render when a prop changes — React's documented
  // alternative to a syncing effect, which would cascade an extra render.
  if (seenData !== data) {
    setSeenData(data)
    setRemaining(initial)
  }

  // Re-registers when data changes so the reset handler closes over the current
  // countdown; cheaper and safer than reading a ref during render.
  useEffect(() => {
    if (!onCommand) return
    onCommand((action) => {
      if (action === 'start') setRunning(true)
      if (action === 'stop') setRunning(false)
      if (action === 'reset') {
        setRunning(false)
        setRemaining(initial)
      }
    })
  }, [onCommand, initial])

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  return (
    <div className={styles.root}>
      <span className={styles.clock}>
        {format(remaining)}
      </span>
      <span className={styles.main}>
        {data.main_text}
      </span>
      {data.subtitle && (
        <span className={styles.subtitle}>
          {data.subtitle}
        </span>
      )}
    </div>
  )
}
