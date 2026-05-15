import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import styles from './EventoInscripciones.module.css'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FILTER_OPTIONS = [
  { value: '',          label: 'Todos' },
  { value: 'pending',   label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'rejected',  label: 'Rechazados' },
]

const STATUS_LABEL = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  rejected:  'Rechazado',
}

function RegistrationRow({ reg, onConfirm, onReject }) {
  const [notes, setNotes]           = useState(reg.adminNotes || '')
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting]   = useState(false)
  const [expanded, setExpanded]     = useState(false)

  async function handleConfirm() {
    setConfirming(true)
    await onConfirm(reg.user._id, notes)
    setConfirming(false)
    setExpanded(false)
  }

  async function handleReject() {
    setRejecting(true)
    await onReject(reg.user._id, notes)
    setRejecting(false)
    setExpanded(false)
  }

  const u = reg.user

  return (
    <div className={`${styles.row} ${styles[`row_${reg.status}`]}`}>
      <div className={styles.rowMain}>
        <div className={styles.userInfo}>
          <span className={styles.avatar}>{u?.displayName?.[0]?.toUpperCase() || u?.username?.[0]?.toUpperCase() || '?'}</span>
          <div className={styles.userDetails}>
            <span className={styles.displayName}>{u?.displayName || u?.username || 'Usuario'}</span>
            <span className={styles.username}>@{u?.username}</span>
          </div>
        </div>

        <div className={styles.rowMeta}>
          <span className={styles.submittedAt}>Enviada: {formatDate(reg.submittedAt)}</span>
          {reg.reviewedAt && (
            <span className={styles.reviewedAt}>Revisada: {formatDate(reg.reviewedAt)}</span>
          )}
        </div>

        {reg.comprobante?.url ? (
          <a
            href={reg.comprobante.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.comprobanteLink} ${reg.comprobante.resourceType === 'raw' ? styles.comprobantePdf : styles.comprobanteImg}`}
            onClick={e => e.stopPropagation()}
          >
            {reg.comprobante.resourceType === 'raw' ? '📄 PDF' : '🖼 Ver'}
          </a>
        ) : (
          <span className={styles.comprobanteNone}>Sin comprobante</span>
        )}

        <span className={`${styles.statusBadge} ${styles[`badge_${reg.status}`]}`}>
          {STATUS_LABEL[reg.status]}
        </span>

        <button
          className={`${styles.actionToggle} ${expanded ? styles.actionToggleOpen : ''}`}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Cerrar' : 'Acciones'}
        </button>
      </div>

      {expanded && (
        <div className={styles.rowActions}>
          <textarea
            className={styles.notesInput}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notas internas (opcional)"
            rows={2}
            maxLength={500}
          />
          {reg.adminNotes && (
            <p className={styles.existingNotes}>
              <strong>Notas actuales:</strong> {reg.adminNotes}
            </p>
          )}
          <div className={styles.actionBtns}>
            <button
              className={styles.btnConfirm}
              onClick={handleConfirm}
              disabled={confirming || rejecting}
            >
              {confirming ? 'Confirmando…' : '✓ Confirmar'}
            </button>
            <button
              className={styles.btnReject}
              onClick={handleReject}
              disabled={confirming || rejecting}
            >
              {rejecting ? 'Rechazando…' : '✕ Rechazar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EventoInscripciones() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()

  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [filter, setFilter]         = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: res } = await axios.get(`/api/eventos/${id}/inscripciones`)
        if (!cancelled) setData(res)
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 404) setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (!authLoading && !user?.isAdmin) return <Navigate to="/" replace />

  async function handleConfirm(userId, adminNotes) {
    setActionError('')
    try {
      await axios.patch(`/api/eventos/${id}/inscripciones/${userId}/confirmar`, { adminNotes })
      setData(prev => ({
        ...prev,
        registrations: prev.registrations.map(r =>
          r.user._id === userId
            ? { ...r, status: 'confirmed', reviewedAt: new Date().toISOString(), adminNotes }
            : r
        ),
        counts: {
          ...prev.counts,
          confirmed: prev.counts.confirmed + (prev.registrations.find(r => r.user._id === userId)?.status !== 'confirmed' ? 1 : 0),
          rejected:  prev.counts.rejected  - (prev.registrations.find(r => r.user._id === userId)?.status === 'rejected'  ? 1 : 0),
          pending:   prev.counts.pending   - (prev.registrations.find(r => r.user._id === userId)?.status === 'pending'   ? 1 : 0),
        },
      }))
    } catch (err) {
      setActionError(err.response?.data?.message || 'Error al confirmar')
    }
  }

  async function handleReject(userId, adminNotes) {
    setActionError('')
    try {
      await axios.patch(`/api/eventos/${id}/inscripciones/${userId}/rechazar`, { adminNotes })
      setData(prev => ({
        ...prev,
        registrations: prev.registrations.map(r =>
          r.user._id === userId
            ? { ...r, status: 'rejected', reviewedAt: new Date().toISOString(), adminNotes }
            : r
        ),
        counts: {
          ...prev.counts,
          rejected:  prev.counts.rejected  + (prev.registrations.find(r => r.user._id === userId)?.status !== 'rejected'  ? 1 : 0),
          confirmed: prev.counts.confirmed - (prev.registrations.find(r => r.user._id === userId)?.status === 'confirmed' ? 1 : 0),
          pending:   prev.counts.pending   - (prev.registrations.find(r => r.user._id === userId)?.status === 'pending'   ? 1 : 0),
        },
      }))
    } catch (err) {
      setActionError(err.response?.data?.message || 'Error al rechazar')
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loadingText}>Cargando inscripciones…</div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.notFound}>Evento no encontrado.</p>
          <Link to="/eventos" className={styles.backLink}>← Volver a Eventos</Link>
        </div>
      </div>
    )
  }

  const registrations = data?.registrations || []
  const counts        = data?.counts        || {}
  const evento        = data?.evento        || {}

  const filtered = filter
    ? registrations.filter(r => r.status === filter)
    : registrations

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Inscripciones — {evento.title} — TurnoCero</title>
      </Helmet>

      <div className={styles.inner}>
        <div className={styles.back}>
          <Link to={`/eventos/${id}`} className={styles.backLink}>← {evento.title}</Link>
        </div>

        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>ADMIN</p>
            <h1 className={styles.title}>Inscripciones</h1>
            <p className={styles.sub}>{evento.title}</p>
          </div>
        </div>

        {/* Counters */}
        <div className={styles.counters}>
          <div className={styles.counter}>
            <span className={styles.counterValue}>{counts.total || 0}</span>
            <span className={styles.counterLabel}>Total</span>
          </div>
          <div className={`${styles.counter} ${styles.counterPending}`}>
            <span className={styles.counterValue}>{counts.pending || 0}</span>
            <span className={styles.counterLabel}>Pendientes</span>
          </div>
          <div className={`${styles.counter} ${styles.counterConfirmed}`}>
            <span className={styles.counterValue}>{counts.confirmed || 0}</span>
            <span className={styles.counterLabel}>Confirmados</span>
          </div>
          <div className={`${styles.counter} ${styles.counterRejected}`}>
            <span className={styles.counterValue}>{counts.rejected || 0}</span>
            <span className={styles.counterLabel}>Rechazados</span>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.filterChip} ${filter === opt.value ? styles.filterChipActive : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {opt.value === 'pending'   && counts.pending   > 0 && <span className={styles.chipCount}>{counts.pending}</span>}
              {opt.value === 'confirmed' && counts.confirmed > 0 && <span className={styles.chipCount}>{counts.confirmed}</span>}
              {opt.value === 'rejected'  && counts.rejected  > 0 && <span className={styles.chipCount}>{counts.rejected}</span>}
            </button>
          ))}
        </div>

        {actionError && <p className={styles.actionError}>{actionError}</p>}

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📋</span>
            <p className={styles.emptyText}>No hay inscripciones en esta categoría.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(reg => (
              <RegistrationRow
                key={reg._id}
                reg={reg}
                onConfirm={handleConfirm}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
