import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import LoginPromptModal from '../../components/shared/LoginPromptModal'
import styles from './EventoDetail.module.css'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFee(fee) {
  if (!fee || fee === 0) return 'Gratis'
  return `$${fee.toLocaleString('es-AR')}`
}

const STATUS_LABEL = {
  open:      'Inscripciones abiertas',
  closed:    'Inscripciones cerradas',
  cancelled: 'Evento cancelado',
  draft:     'Borrador',
}

function ImageDropzone({ preview, onFile }) {
  const inputRef  = useRef(null)
  const onFileRef = useRef(onFile)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { onFileRef.current = onFile }, [onFile])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  const classes = [
    styles.dropzone,
    preview  ? styles.dropzoneWithPreview : '',
    dragOver ? styles.dropzoneDragOver    : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
    >
      {preview ? (
        <img src={preview} alt="preview" className={styles.dropzonePreview} />
      ) : (
        <div className={styles.dropzonePlaceholder}>
          <span className={styles.dropzoneIcon}>🖼</span>
          <span className={styles.dropzoneText}>Arrastrá, pegá o hacé click</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className={styles.fileInput}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

function ComprobanteDropzone({ file, onFile }) {
  const inputRef  = useRef(null)
  const onFileRef = useRef(onFile)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { onFileRef.current = onFile }, [onFile])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  const isPdf    = file?.type === 'application/pdf'
  const preview  = file && !isPdf ? URL.createObjectURL(file) : null
  const fileName = file?.name

  const classes = [
    styles.comprobanteDropzone,
    file     ? styles.comprobanteDropzoneActive : '',
    dragOver ? styles.dropzoneDragOver          : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
    >
      {preview ? (
        <img src={preview} alt="comprobante" className={styles.comprobantePreview} />
      ) : file ? (
        <div className={styles.comprobantePdfLabel}>
          <span className={styles.comprobantePdfIcon}>📄</span>
          <span className={styles.comprobantePdfName}>{fileName}</span>
          <span className={styles.comprobanteChange}>Cambiar archivo</span>
        </div>
      ) : (
        <div className={styles.comprobanteEmpty}>
          <span className={styles.comprobanteEmptyIcon}>📎</span>
          <span className={styles.comprobanteEmptyText}>Adjuntá el comprobante de transferencia</span>
          <span className={styles.comprobanteEmptySub}>JPG, PNG o PDF · máx. 10 MB</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className={styles.fileInput}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

export default function EventoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.isAdmin

  const [evento, setEvento]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [notFound, setNotFound]           = useState(false)
  const [lightbox, setLightbox]           = useState(false)

  // Inscription state
  const [userReg, setUserReg]             = useState(null)
  const [showModal, setShowModal]         = useState(false)
  const [comprobanteFile, setComprobanteFile] = useState(null)
  const [inscribing, setInscribing]       = useState(false)
  const [inscribed, setInscribed]         = useState(false)
  const [cancelling, setCancelling]       = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [regError, setRegError]           = useState('')
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // Admin edit state
  const [editing, setEditing]             = useState(false)
  const [editForm, setEditForm]           = useState({})
  const [editFile, setEditFile]           = useState(null)
  const [editPreview, setEditPreview]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [editError, setEditError]         = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await axios.get(`/api/eventos/${id}`)
        if (cancelled) return
        setEvento(data)
        setUserReg(data.userRegistration)
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

  function startEdit() {
    setEditForm({
      title:           evento.title           || '',
      description:     evento.description     || '',
      conditions:      evento.conditions      || '',
      fee:             evento.fee             ?? 0,
      transferDetails: evento.transferDetails || '',
      eventDate:       evento.eventDate ? evento.eventDate.slice(0, 16) : '',
      location:        evento.location        || '',
      maxParticipants: evento.maxParticipants || '',
      status:          evento.status          || 'open',
    })
    setEditPreview(evento.image?.url || '')
    setEditFile(null)
    setEditing(true)
    setEditError('')
  }

  function handleEditChange(e) {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!editForm.title.trim()) { setEditError('El título es obligatorio'); return }
    setSaving(true)
    setEditError('')
    try {
      const fd = new FormData()
      Object.entries(editForm).forEach(([k, v]) => fd.append(k, v))
      if (editFile) fd.append('image', editFile)
      const { data } = await axios.put(`/api/eventos/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setEvento(prev => ({ ...prev, ...data }))
      setEditing(false)
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await axios.delete(`/api/eventos/${id}`)
      navigate('/eventos')
    } catch {
      setConfirmDelete(false)
      setDeleting(false)
    }
  }

  async function handleInscribirse() {
    if (!user) { setShowLoginPrompt(true); return }
    const isPaid = evento.fee > 0
    if (isPaid && !comprobanteFile) {
      setRegError('Debés adjuntar el comprobante de transferencia')
      return
    }
    setInscribing(true)
    setRegError('')
    try {
      const fd = new FormData()
      if (comprobanteFile) fd.append('comprobante', comprobanteFile)
      const { data } = await axios.post(`/api/eventos/${id}/inscribirse`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUserReg(data)
      setEvento(prev => ({
        ...prev,
        registrationCount: {
          ...prev.registrationCount,
          total:   (prev.registrationCount?.total   || 0) + 1,
          pending: (prev.registrationCount?.pending || 0) + 1,
        },
      }))
      setInscribed(true)
      setComprobanteFile(null)
    } catch (err) {
      setRegError(err.response?.data?.message || 'Error al inscribirse')
    } finally {
      setInscribing(false)
    }
  }

  async function handleCancelReg() {
    setCancelling(true)
    try {
      await axios.delete(`/api/eventos/${id}/inscribirse`)
      setUserReg(null)
      setInscribed(false)
      setConfirmCancel(false)
      setEvento(prev => ({
        ...prev,
        registrationCount: {
          ...prev.registrationCount,
          total:   Math.max(0, (prev.registrationCount?.total   || 1) - 1),
          pending: Math.max(0, (prev.registrationCount?.pending || 1) - 1),
        },
      }))
    } catch (err) {
      setRegError(err.response?.data?.message || 'Error al cancelar')
      setConfirmCancel(false)
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.skeleton}>
            <div className={styles.skeletonImg} />
            <div className={styles.skeletonBody}>
              <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonMeta}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonText}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonText}`} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.notFound}>
            <p className={styles.notFoundIcon}>🎲</p>
            <h2 className={styles.notFoundTitle}>Evento no encontrado</h2>
            <Link to="/eventos" className={styles.backLink}>← Volver a Eventos</Link>
          </div>
        </div>
      </div>
    )
  }

  const canRegister    = evento.status === 'open' && !userReg
  const hasPending     = userReg?.status === 'pending'
  const hasConfirmed   = userReg?.status === 'confirmed'
  const hasRejected    = userReg?.status === 'rejected'

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{evento.title} — TurnoCero</title>
        <meta name="description" content={evento.description || `Evento: ${evento.title}`} />
      </Helmet>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>✕</button>
          <img src={evento.image.url} alt={evento.title} className={styles.lightboxImg} />
        </div>
      )}

      <LoginPromptModal
        isOpen={showLoginPrompt}
        message="Iniciá sesión para inscribirte en este evento"
        onClose={() => setShowLoginPrompt(false)}
      />

      <div className={styles.inner}>
        <div className={styles.back}>
          <Link to="/eventos" className={styles.backLink}>← Eventos</Link>
        </div>

        <div className={styles.layout}>
          {/* ── Main content ── */}
          <div className={styles.main}>
            {editing ? (
              <form className={styles.editForm} onSubmit={handleSave}>
                <p className={styles.editTitle}>Editando evento</p>
                <ImageDropzone
                  preview={editPreview}
                  onFile={(f) => { setEditFile(f); setEditPreview(URL.createObjectURL(f)) }}
                />
                <input
                  name="title"
                  value={editForm.title}
                  onChange={handleEditChange}
                  placeholder="Título *"
                  className={styles.fieldInput}
                  maxLength={200}
                />
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  placeholder="Descripción"
                  className={styles.fieldTextarea}
                  rows={3}
                  maxLength={3000}
                />
                <textarea
                  name="conditions"
                  value={editForm.conditions}
                  onChange={handleEditChange}
                  placeholder="Condiciones de inscripción"
                  className={styles.fieldTextarea}
                  rows={3}
                  maxLength={2000}
                />
                <div className={styles.row}>
                  <input
                    name="fee"
                    value={editForm.fee}
                    onChange={handleEditChange}
                    placeholder="Monto ($ARS)"
                    className={styles.fieldInput}
                    type="number"
                    min="0"
                    style={{ flex: 1 }}
                  />
                  <input
                    name="maxParticipants"
                    value={editForm.maxParticipants}
                    onChange={handleEditChange}
                    placeholder="Cupo máximo"
                    className={styles.fieldInput}
                    type="number"
                    min="1"
                    style={{ flex: 1 }}
                  />
                </div>
                <textarea
                  name="transferDetails"
                  value={editForm.transferDetails}
                  onChange={handleEditChange}
                  placeholder="Datos de transferencia (alias, CBU, instrucciones)"
                  className={styles.fieldTextarea}
                  rows={2}
                  maxLength={500}
                />
                <div className={styles.row}>
                  <input
                    name="eventDate"
                    value={editForm.eventDate}
                    onChange={handleEditChange}
                    type="datetime-local"
                    className={styles.fieldInput}
                    style={{ flex: 1 }}
                  />
                  <input
                    name="location"
                    value={editForm.location}
                    onChange={handleEditChange}
                    placeholder="Lugar"
                    className={styles.fieldInput}
                    maxLength={300}
                    style={{ flex: 1 }}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Estado</label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className={styles.fieldSelect}
                  >
                    <option value="draft">Borrador</option>
                    <option value="open">Abierto</option>
                    <option value="closed">Cerrado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                {editError && <p className={styles.errorMsg}>{editError}</p>}
                <div className={styles.editActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {evento.image?.url && (
                  <button className={styles.imageBtn} onClick={() => setLightbox(true)}>
                    <img src={evento.image.url} alt={evento.title} className={styles.heroImage} />
                  </button>
                )}

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.statusRow}>
                      <span className={`${styles.statusBadge} ${styles[`status_${evento.status}`]}`}>
                        {STATUS_LABEL[evento.status] || evento.status}
                      </span>
                      {evento.maxParticipants && (
                        <span className={styles.capacityBadge}>
                          {evento.registrationCount?.confirmed || 0} / {evento.maxParticipants} confirmados
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className={styles.adminActions}>
                        {confirmDelete ? (
                          <div className={styles.confirmRow}>
                            <span className={styles.confirmLabel}>¿Eliminar?</span>
                            <button
                              className={styles.confirmYes}
                              onClick={handleDelete}
                              disabled={deleting}
                            >
                              {deleting ? '…' : 'Sí'}
                            </button>
                            <button
                              className={styles.confirmNo}
                              onClick={() => setConfirmDelete(false)}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button className={styles.editBtn} onClick={startEdit}>Editar</button>
                            <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <h1 className={styles.eventTitle}>{evento.title}</h1>

                  <div className={styles.metaList}>
                    {evento.eventDate && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaIcon}>📅</span>
                        <span>{formatDate(evento.eventDate)}</span>
                      </div>
                    )}
                    {evento.location && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaIcon}>📍</span>
                        <span>{evento.location}</span>
                      </div>
                    )}
                    <div className={styles.metaItem}>
                      <span className={styles.metaIcon}>💰</span>
                      <span className={styles.fee}>{formatFee(evento.fee)}</span>
                    </div>
                    {evento.registrationCount?.total > 0 && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaIcon}>👥</span>
                        <span>{evento.registrationCount.total} inscripciones ({evento.registrationCount.pending} pendientes)</span>
                      </div>
                    )}
                  </div>

                  {evento.description && (
                    <div className={styles.section}>
                      <h2 className={styles.sectionTitle}>Descripción</h2>
                      <p className={styles.body}>{evento.description}</p>
                    </div>
                  )}

                  {evento.conditions && (
                    <div className={styles.section}>
                      <h2 className={styles.sectionTitle}>Condiciones de inscripción</h2>
                      <p className={styles.body}>{evento.conditions}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className={styles.aside}>
            {/* Admin: manage registrations link */}
            {isAdmin && (
              <Link to={`/eventos/${id}/inscripciones`} className={styles.manageBtn}>
                <span>Gestionar inscripciones</span>
                <span className={styles.manageBadge}>
                  {evento.registrationCount?.pending || 0} pendientes
                </span>
              </Link>
            )}

            {/* Registration section */}
            <div className={styles.regCard}>
              <h2 className={styles.regTitle}>Inscripción</h2>

              {/* State: not logged in */}
              {!user && (
                <div className={styles.regNotLogged}>
                  <p className={styles.regText}>Iniciá sesión para poder inscribirte.</p>
                  <button
                    className={styles.btnInscribirse}
                    onClick={() => setShowLoginPrompt(true)}
                  >
                    Iniciar sesión
                  </button>
                </div>
              )}

              {/* State: user has confirmed registration */}
              {user && hasConfirmed && (
                <div className={styles.regConfirmed}>
                  <p className={styles.regStatusIcon}>✅</p>
                  <p className={styles.regStatusTitle}>¡Inscripción confirmada!</p>
                  <p className={styles.regStatusText}>Tu lugar en el evento está reservado.</p>
                </div>
              )}

              {/* State: user has rejected registration */}
              {user && hasRejected && (
                <div className={styles.regRejected}>
                  <p className={styles.regStatusIcon}>❌</p>
                  <p className={styles.regStatusTitle}>Inscripción rechazada</p>
                  <p className={styles.regStatusText}>El admin revisó y no pudo confirmar tu inscripción.</p>
                </div>
              )}

              {/* State: user has pending registration — show modal or status */}
              {user && hasPending && !showModal && (
                <div className={styles.regPending}>
                  <p className={styles.regStatusIcon}>⏳</p>
                  <p className={styles.regStatusTitle}>Pendiente de revisión</p>
                  <p className={styles.regStatusText}>
                    El admin revisará tu comprobante y confirmará la inscripción a la brevedad.
                  </p>
                  {userReg?.comprobante?.url && (
                    <a
                      href={userReg.comprobante.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.formLink}
                    >
                      Ver comprobante enviado →
                    </a>
                  )}
                  {!confirmCancel ? (
                    <button
                      className={styles.btnCancel}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Cancelar inscripción
                    </button>
                  ) : (
                    <div className={styles.cancelConfirm}>
                      <p className={styles.cancelConfirmText}>¿Cancelar inscripción?</p>
                      <div className={styles.cancelConfirmActions}>
                        <button
                          className={styles.confirmYes}
                          onClick={handleCancelReg}
                          disabled={cancelling}
                        >
                          {cancelling ? '…' : 'Sí, cancelar'}
                        </button>
                        <button
                          className={styles.confirmNo}
                          onClick={() => setConfirmCancel(false)}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {regError && <p className={styles.regError}>{regError}</p>}
                </div>
              )}

              {/* State: inscribed flow complete */}
              {user && inscribed && hasPending && !showModal && (
                <div className={styles.regSuccess}>
                  <p className={styles.regSuccessText}>
                    ✅ Comprobante enviado. El admin lo revisará y confirmará tu inscripción.
                  </p>
                </div>
              )}

              {/* State: event closed / cancelled, not registered */}
              {user && !userReg && evento.status !== 'open' && (
                <div className={styles.regClosed}>
                  <p className={styles.regText}>Las inscripciones están cerradas.</p>
                </div>
              )}

              {/* State: can register — show modal or button */}
              {user && canRegister && !showModal && (
                <button
                  className={styles.btnInscribirse}
                  onClick={() => setShowModal(true)}
                >
                  Inscribirse
                </button>
              )}

              {/* Inscription confirmation modal (inline) */}
              {user && showModal && !userReg && (
                <div className={styles.inscriptionModal}>
                  <h3 className={styles.modalTitle}>Confirmá tu inscripción</h3>

                  {evento.conditions && (
                    <div className={styles.modalSection}>
                      <p className={styles.modalLabel}>Condiciones</p>
                      <p className={styles.modalText}>{evento.conditions}</p>
                    </div>
                  )}

                  {evento.fee > 0 && (
                    <>
                      <div className={styles.modalSection}>
                        <p className={styles.modalLabel}>Monto a abonar</p>
                        <p className={styles.modalFee}>{formatFee(evento.fee)}</p>
                      </div>

                      {evento.transferDetails && (
                        <div className={styles.modalSection}>
                          <p className={styles.modalLabel}>Datos de transferencia</p>
                          <p className={styles.modalText}>{evento.transferDetails}</p>
                        </div>
                      )}

                      <div className={styles.modalSection}>
                        <p className={styles.modalLabel}>Comprobante de pago *</p>
                        <ComprobanteDropzone
                          file={comprobanteFile}
                          onFile={setComprobanteFile}
                        />
                      </div>
                    </>
                  )}

                  {regError && <p className={styles.regError}>{regError}</p>}

                  <div className={styles.modalActions}>
                    <button
                      className={styles.btnGhost}
                      onClick={() => { setShowModal(false); setRegError(''); setComprobanteFile(null) }}
                      disabled={inscribing}
                    >
                      Cancelar
                    </button>
                    <button
                      className={styles.btnInscribirse}
                      onClick={async () => {
                        await handleInscribirse()
                        setShowModal(false)
                      }}
                      disabled={inscribing || (evento.fee > 0 && !comprobanteFile)}
                    >
                      {inscribing ? 'Enviando…' : 'Confirmar inscripción'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Transfer details — shown to confirmed users for reference */}
            {evento.transferDetails && userReg?.status === 'confirmed' && (
              <div className={styles.transferCard}>
                <h3 className={styles.transferTitle}>Datos de transferencia</h3>
                <p className={styles.transferText}>{evento.transferDetails}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
