import styles from './Scoreboard.module.scss'
import type { Data } from './model'

type Side = { name?: string; score?: number }

export default function Scoreboard({
  data,
}: {
  data: { widget: Data; match?: { participant_left?: Side; participant_right?: Side } }
}) {
  const left = data.match?.participant_left ?? {}
  const right = data.match?.participant_right ?? {}
  return (
    <div className={styles.root}>
      <span className={styles.team}>{left.name ?? 'TBD'}</span>
      <span className={styles.score}>{`${left.score ?? 0} : ${right.score ?? 0}`}</span>
      <span className={styles.team}>{right.name ?? 'TBD'}</span>
    </div>
  )
}
