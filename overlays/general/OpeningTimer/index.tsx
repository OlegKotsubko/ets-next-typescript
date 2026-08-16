import styles from './OpeningTimer.module.scss'
import type { Data } from './model'

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function OpeningTimer({ data }: { data: { widget: Data } }) {
  return (
    <div className={styles.root}>
      <div className={styles.label}>{data.widget.label}</div>
      <div className={styles.time}>{fmt(Number(data.widget.duration ?? 0))}</div>
    </div>
  )
}
