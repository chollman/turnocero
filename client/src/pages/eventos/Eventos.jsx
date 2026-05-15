import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import EventoCard from './EventoCard'
import EventoSkeleton from './EventoSkeleton'
import styles from './Eventos.module.css'

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
          <span className={styles.dropzoneText}>Arrastrá, pegá o hacé click para subir imagen</span>
          <span className={styles.dropzoneSub}>JPG, PNG, WEBP · máx. 5 MB</span>
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

const STATUS_OPTIONS = [
  { value: '',          label: 'Todos' },
  { value: 'open',      label: 'Abiertos' },
  { value: 'closed',    label: 'Cerrados' },
  { value: 'draft',     label: 'Borradores' },
  { value: 'cancelled', label: 'Cancelados' },
]

const EMPTY_FORM = {
  title: '', description: '', conditions: '', fee: '',
  transferDetails: '', eventDate: '',
  location: '', maxParticipants: '', status: 'open',
}

export default function Eventos() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin

  const [eventos, setEventos]       = useState([])
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [file, setFile]         = useState(null)
  const [preview, setPreview]   = useState('')
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState('')

  const load = useCallback(async (pageNum = 1, replace = true) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = { page: pageNum, limit: 9 }
      if (statusFilter) params.status = statusFilter
      const { data } = await axios.get('/api/eventos', { params })
      setEventos(prev => replace ? data.eventos : [...prev, ...data.eventos])
      setTotalPages(data.pages)
      setPage(pageNum)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [statusFilter])

  useEffect(() => { load(1, true) }, [load])

  function handleFile(f) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('El título es obligatorio'); return }
    setSub(true)
    setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
      if (file) fd.append('image', file)
      const { data } = await axios.post('/api/eventos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setEventos(prev => [data, ...prev])
      setCreating(false)
      setForm(EMPTY_FORM)
      setFile(null)
      setPreview('')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear el evento')
    } finally {
      setSub(false)
    }
  }

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Eventos — TurnoCero</title>
        <meta name="description" content="Eventos y torneos de la comunidad de juegos de mesa" />
      </Helmet>

      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>COMUNIDAD</p>
            <h1 className={styles.title}>Eventos</h1>
            <p className={styles.sub}>Torneos, encuentros y actividades de la comunidad</p>
          </div>
          {isAdmin && (
            <button
              className={`${styles.newBtn} ${creating ? styles.newBtnActive : ''}`}
              onClick={() => { setCreating(v => !v); setError('') }}
            >
              {creating ? 'Cancelar' : '+ Nuevo evento'}
            </button>
          )}
        </div>

        {isAdmin && creating && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <p className={styles.createTitle}>Nuevo evento</p>
            <ImageDropzone preview={preview} onFile={handleFile} />

            <input
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="Título del evento *"
              className={styles.fieldInput}
              maxLength={200}
            />
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Descripción"
              className={styles.fieldTextarea}
              rows={3}
              maxLength={3000}
            />
            <textarea
              name="conditions"
              value={form.conditions}
              onChange={handleFormChange}
              placeholder="Condiciones de inscripción"
              className={styles.fieldTextarea}
              rows={3}
              maxLength={2000}
            />

            <div className={styles.row}>
              <input
                name="fee"
                value={form.fee}
                onChange={handleFormChange}
                placeholder="Monto ($ARS), 0 = gratis"
                className={styles.fieldInput}
                type="number"
                min="0"
                style={{ flex: 1 }}
              />
              <input
                name="maxParticipants"
                value={form.maxParticipants}
                onChange={handleFormChange}
                placeholder="Cupo máximo (vacío = sin límite)"
                className={styles.fieldInput}
                type="number"
                min="1"
                style={{ flex: 1 }}
              />
            </div>

            <textarea
              name="transferDetails"
              value={form.transferDetails}
              onChange={handleFormChange}
              placeholder="Datos de transferencia (alias, CBU, instrucciones de pago)"
              className={styles.fieldTextarea}
              rows={2}
              maxLength={500}
            />

            <div className={styles.row}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Fecha del evento</label>
                <input
                  name="eventDate"
                  value={form.eventDate}
                  onChange={handleFormChange}
                  type="datetime-local"
                  className={styles.fieldInput}
                />
              </div>
              <input
                name="location"
                value={form.location}
                onChange={handleFormChange}
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
                value={form.status}
                onChange={handleFormChange}
                className={styles.fieldSelect}
              >
                <option value="draft">Borrador (no visible)</option>
                <option value="open">Abierto (inscripciones habilitadas)</option>
                <option value="closed">Cerrado (sin inscripciones)</option>
              </select>
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}
            <div className={styles.createActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => { setCreating(false); setError('') }}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPublish} disabled={submitting}>
                {submitting ? 'Creando…' : 'Crear evento'}
              </button>
            </div>
          </form>
        )}

        {isAdmin && (
          <div className={styles.filters}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`${styles.filterChip} ${statusFilter === opt.value ? styles.filterChipActive : ''}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map(i => <EventoSkeleton key={i} />)}
          </div>
        ) : eventos.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🎲</span>
            <h2 className={styles.emptyTitle}>No hay eventos por ahora</h2>
          </div>
        ) : (
          <div
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${Math.min(eventos.length, 3)}, 1fr)` }}
          >
            {eventos.map(ev => (
              <EventoCard key={ev._id} evento={ev} />
            ))}
            {page < totalPages && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => load(page + 1, false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Cargando…' : 'Ver más eventos'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
