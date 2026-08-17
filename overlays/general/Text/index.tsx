import styles from './Text.module.scss'
import type { Data } from './model'

export default function Text({ data }: { data: { widget: Data } }) {
  return (
    <div className={styles.root}>
      <span className={styles.text}>
        {data.widget.text}
      </span>
    </div>
  )
}
