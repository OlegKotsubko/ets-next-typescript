import type { TitleProps } from '@/lib/titles/types'
import type { Data } from './model'
import styles from './LowerThird.module.scss'

export default function LowerThird({ data }: TitleProps<Data>) {
  return (
    <div className={styles.root}>
      <span className={styles.name}>
        {data.playerName}
      </span>
      {data.teamName && (
        <span className={styles.team}>
          {data.teamName}
        </span>
      )}
    </div>
  )
}
