import styles from './Intro.module.scss'
import type { Data } from './model'

export default function Intro({ data }: { data: { widget: Data } }) {
  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>{data.widget.heading}</h1>
      {data.widget.subheading ? <p className={styles.sub}>{data.widget.subheading}</p> : null}
    </div>
  )
}
