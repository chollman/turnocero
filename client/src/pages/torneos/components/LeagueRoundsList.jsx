import UserRef from '../../../components/shared/UserRef'
import styles from '../TorneoDetail.module.css'

export default function LeagueRoundsList({ matches, isAdmin, onRecord, onUndo }) {
  if (!matches || matches.length === 0) {
    return <p className={styles.emptyMsg}>Todavía no se generó el fixture.</p>
  }

  const rounds = groupByRound(matches)

  return (
    <div className={styles.roundsList}>
      {rounds.map((roundMatches, idx) => (
        <div key={idx} className={styles.roundBlock}>
          <h4 className={styles.roundBlockTitle}>Ronda {idx + 1}</h4>
          <div className={styles.matchList}>
            {roundMatches.map((m) => (
              <MatchRow
                key={m._id}
                match={m}
                isAdmin={isAdmin}
                onRecord={onRecord}
                onUndo={onUndo}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MatchRow({ match, isAdmin, onRecord, onUndo }) {
  const aId = match.playerA?._id ? String(match.playerA._id) : null
  const bId = match.playerB?._id ? String(match.playerB._id) : null
  const winId = match.winner?._id ? String(match.winner._id) : null
  const isBye = match.status === 'bye'
  const isCompleted = match.status === 'completed'

  return (
    <div className={`${styles.matchRow} ${isCompleted ? styles.matchRowDone : ''} ${isBye ? styles.matchRowBye : ''}`}>
      <div className={`${styles.matchSide} ${winId === aId ? styles.matchSideWinner : ''}`}>
        {match.playerA ? <UserRef user={match.playerA} noLink /> : <span className={styles.matchPlaceholder}>—</span>}
        {match.isDraw && <span className={styles.matchTag}>empate</span>}
        {!match.isDraw && winId === aId && <span className={styles.matchCheck}>✓</span>}
      </div>
      <span className={styles.matchVs}>vs</span>
      <div className={`${styles.matchSide} ${winId === bId ? styles.matchSideWinner : ''} ${styles.matchSideRight}`}>
        {!match.isDraw && winId === bId && <span className={styles.matchCheck}>✓</span>}
        {match.isDraw && <span className={styles.matchTag}>empate</span>}
        {match.playerB ? <UserRef user={match.playerB} noLink /> : <span className={styles.matchPlaceholder}>—</span>}
      </div>

      <div className={styles.matchActions}>
        {isBye && <span className={styles.byeChip}>BYE</span>}
        {isAdmin && match.status === 'pending' && match.playerA && match.playerB && (
          <button className={styles.matchBtnPrimary} onClick={() => onRecord(match)}>Cargar</button>
        )}
        {isAdmin && isCompleted && (
          <button className={styles.matchBtnGhost} onClick={() => onUndo(match)}>Deshacer</button>
        )}
      </div>
    </div>
  )
}

function groupByRound(matches) {
  const map = new Map()
  for (const m of matches) {
    if (!map.has(m.round)) map.set(m.round, [])
    map.get(m.round).push(m)
  }
  return [...map.keys()].sort((a, b) => a - b).map((r) =>
    map.get(r).sort((x, y) => x.matchIndex - y.matchIndex)
  )
}
