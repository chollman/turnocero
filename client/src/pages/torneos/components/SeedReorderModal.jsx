import { useState, useEffect } from 'react'
import axios from 'axios'
import UserRef from '../../../components/shared/UserRef'
import { getUserDisplay } from '../../../utils/userDisplay'
import ModalPortal from '../../../components/shared/ModalPortal'
import styles from '../TorneoDetail.module.css'

export default function SeedReorderModal({ torneo, onClose, onSaved }) {
  const [order, setOrder]     = useState(torneo.participants || [])
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => { setOrder(torneo.participants || []) }, [torneo._id])

  const move = (idx, dir) => {
    const target = idx + dir
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
  }

  const handleSave = async () => {
    setSub(true); setError('')
    try {
      const ids = order.map((u) => u._id || u)
      const { data } = await axios.patch(`/api/torneos/${torneo._id}/seeds`, { participantIds: ids })
      onSaved(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSub(false)
    }
  }

  return (
    <ModalPortal>
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Reordenar seeds</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className={styles.modalSub}>El orden determina el seeding del fixture. Cambiá usando las flechas.</p>

        <ul className={styles.seedList}>
          {order.map((u, i) => {
            const info = getUserDisplay(u)
            return (
              <li key={u._id || u} className={styles.seedItem}>
                <span className={styles.seedNumber}>#{i + 1}</span>
                <span className={styles.seedName}>
                  {info.isDeleted ? <span className={styles.deletedTxt}>Usuario eliminado</span> : <UserRef user={u} noLink />}
                </span>
                <span className={styles.seedActions}>
                  <button
                    className={styles.seedBtn}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                  >↑</button>
                  <button
                    className={styles.seedBtn}
                    onClick={() => move(i, +1)}
                    disabled={i === order.length - 1}
                    aria-label="Bajar"
                  >↓</button>
                </span>
              </li>
            )
          })}
        </ul>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose} disabled={submitting}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar orden'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
