import { useState } from 'react'
import axios from 'axios'
import UserRef from '../../../components/shared/UserRef'
import { getUserDisplay } from '../../../utils/userDisplay'
import styles from '../TorneoDetail.module.css'

export default function RegistrationsList({ torneo, onChange }) {
  const pending = torneo.pendingRegistrations || []

  if (pending.length === 0) {
    return (
      <p className={styles.emptyMsg}>No hay inscripciones pendientes.</p>
    )
  }

  return (
    <ul className={styles.regList}>
      {pending.map((reg) => (
        <RegistrationItem
          key={reg.user?._id || reg.user}
          registration={reg}
          torneoId={torneo._id}
          onChange={onChange}
        />
      ))}
    </ul>
  )
}

function RegistrationItem({ registration, torneoId, onChange }) {
  const [busy, setBusy] = useState(false)
  const userId = registration.user?._id || registration.user
  const info = getUserDisplay(registration.user)

  const accept = async () => {
    setBusy(true)
    try {
      const { data } = await axios.post(`/api/torneos/${torneoId}/registrations/${userId}/accept`)
      onChange(data)
    } catch { /* user can retry */ } finally { setBusy(false) }
  }

  const reject = async () => {
    setBusy(true)
    try {
      const { data } = await axios.post(`/api/torneos/${torneoId}/registrations/${userId}/reject`)
      onChange(data)
    } catch { /* user can retry */ } finally { setBusy(false) }
  }

  return (
    <li className={styles.regItem}>
      <span className={styles.regUser}>
        {info.isDeleted ? <span className={styles.deletedTxt}>Usuario eliminado</span> : <UserRef user={registration.user} />}
      </span>
      <span className={styles.regDate}>
        {new Date(registration.requestedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
      </span>
      <span className={styles.regActions}>
        <button className={styles.regAccept} onClick={accept} disabled={busy}>Aceptar</button>
        <button className={styles.regReject} onClick={reject} disabled={busy}>Rechazar</button>
      </span>
    </li>
  )
}
