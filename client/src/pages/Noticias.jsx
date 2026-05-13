import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import styles from './Noticias.module.css'

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000
  if (diff < 60)     return 'ahora'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ImageDropzone({ preview, onFile }) {
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={`${styles.dropzone} ${preview ? styles.dropzoneWithPreview : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
    >
      {preview ? (
        <img src={preview} alt="preview" className={styles.dropzonePreview} />
      ) : (
        <div className={styles.dropzonePlaceholder}>
          <span className={styles.dropzoneIcon}>🖼</span>
          <span className={styles.dropzoneText}>Arrastrá o hacé click para subir la imagen</span>
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

function NoticiaCard({ noticia: initial, onDeleted, onUpdated, isAdmin }) {
  const [noticia, setNoticia]     = useState(initial)
  const [lightbox, setLightbox]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [confirming, setConfirm]  = useState(false)

  // edit form state
  const [editTitle, setEditTitle] = useState(noticia.title || '')
  const [editBody, setEditBody]   = useState(noticia.body  || '')
  const [editLink, setEditLink]   = useState(noticia.link  || '')
  const [newFile, setNewFile]     = useState(null)
  const [newPreview, setNewPreview] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [editError, setEditError] = useState('')

  const openEdit = () => {
    setEditTitle(noticia.title || '')
    setEditBody(noticia.body   || '')
    setEditLink(noticia.link   || '')
    setNewFile(null)
    setNewPreview(null)
    setEditError('')
    setEditing(true)
  }

  const handleNewFile = (f) => {
    setNewFile(f)
    setNewPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    setSaving(true)
    setEditError('')
    try {
      const fd = new FormData()
      fd.append('title', editTitle.trim())
      fd.append('body',  editBody.trim())
      fd.append('link',  editLink.trim())
      if (newFile) fd.append('image', newFile)
      const { data } = await axios.put(`/api/noticias/${noticia._id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setNoticia(data)
      onUpdated?.(data)
      setEditing(false)
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/noticias/${noticia._id}`)
      onDeleted(noticia._id)
    } catch { /* silently ignore */ }
  }

  return (
    <>
      <article className={styles.card}>
        {/* ── Image / edit dropzone ── */}
        {editing ? (
          <div className={styles.editImageWrap}>
            <ImageDropzone
              preview={newPreview || noticia.image.url}
              onFile={handleNewFile}
            />
            {newFile && (
              <span className={styles.editImageHint}>
                Nueva imagen seleccionada — se reemplazará al guardar
              </span>
            )}
          </div>
        ) : (
          <button
            className={styles.imageBtn}
            onClick={() => setLightbox(true)}
            aria-label="Ver imagen completa"
          >
            <img src={noticia.image.url} alt={noticia.title || 'Noticia'} className={styles.image} />
          </button>
        )}

        <div className={styles.cardBody}>
          {/* ── Meta row: date + admin actions ── */}
          <div className={styles.cardMeta}>
            <span className={styles.cardDate}>{timeAgo(noticia.createdAt)}</span>
            {isAdmin && !editing && (
              <div className={styles.adminActions}>
                <button className={styles.editBtn} onClick={openEdit}>Editar</button>
                {confirming ? (
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmLabel}>¿Eliminar?</span>
                    <button className={styles.confirmYes} onClick={handleDelete}>Sí</button>
                    <button className={styles.confirmNo} onClick={() => setConfirm(false)}>No</button>
                  </div>
                ) : (
                  <button className={styles.deleteBtn} onClick={() => setConfirm(true)}>Eliminar</button>
                )}
              </div>
            )}
          </div>

          {/* ── Content or edit form ── */}
          {editing ? (
            <div className={styles.editForm}>
              <input
                className={styles.fieldInput}
                placeholder="Título (opcional)"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
              />
              <textarea
                className={styles.fieldTextarea}
                placeholder="Descripción (opcional)"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                maxLength={2000}
              />
              <input
                className={styles.fieldInput}
                placeholder="Link externo (opcional) — https://..."
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                maxLength={500}
                type="url"
              />
              {editError && <p className={styles.errorMsg}>{editError}</p>}
              <div className={styles.editActions}>
                <button
                  className={styles.btnGhost}
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className={styles.btnPublish}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {noticia.title && <h2 className={styles.cardTitle}>{noticia.title}</h2>}
              {noticia.body  && <p  className={styles.cardText}>{noticia.body}</p>}
              {noticia.link  && (
                <a
                  href={noticia.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.cardLink}
                >
                  Ver más →
                </a>
              )}
            </>
          )}
        </div>
      </article>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <img src={noticia.image.url} alt={noticia.title || ''} className={styles.lightboxImg} />
          <button className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </>
  )
}

function CreateForm({ onCreated, onCancel }) {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [link, setLink]         = useState('')
  const [file, setFile]         = useState(null)
  const [preview, setPreview]   = useState(null)
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState('')

  const handleFile = (f) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('Seleccioná una imagen'); return }
    setSub(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      if (title.trim()) fd.append('title', title.trim())
      if (body.trim())  fd.append('body',  body.trim())
      if (link.trim())  fd.append('link',  link.trim())
      const { data } = await axios.post('/api/noticias', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onCreated(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al publicar')
    } finally {
      setSub(false)
    }
  }

  return (
    <form className={styles.createForm} onSubmit={handleSubmit}>
      <h3 className={styles.createTitle}>Nueva noticia</h3>

      <ImageDropzone preview={preview} onFile={handleFile} />

      <input
        className={styles.fieldInput}
        placeholder="Título (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />

      <textarea
        className={styles.fieldTextarea}
        placeholder="Descripción (opcional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
      />

      <input
        className={styles.fieldInput}
        placeholder="Link externo (opcional) — https://..."
        value={link}
        onChange={(e) => setLink(e.target.value)}
        maxLength={500}
        type="url"
      />

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.createActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className={styles.btnPublish} disabled={submitting || !file}>
          {submitting ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}

export default function Noticias() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin

  const [noticias, setNoticias] = useState([])
  const [page, setPage]         = useState(1)
  const [totalPages, setTotal]  = useState(1)
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setMore]  = useState(false)
  const [showCreate, setCreate] = useState(false)

  const load = useCallback(async (pageNum = 1, replace = true) => {
    if (pageNum === 1) setLoading(true); else setMore(true)
    try {
      const { data } = await axios.get('/api/noticias', { params: { page: pageNum, limit: 10 } })
      setNoticias((prev) => replace ? data.noticias : [...prev, ...data.noticias])
      setTotal(data.pages)
      setPage(pageNum)
    } catch { /* silently ignore */ } finally {
      setLoading(false)
      setMore(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const handleCreated = (noticia) => {
    setNoticias((prev) => [noticia, ...prev])
    setCreate(false)
  }

  const handleDeleted = (id) => setNoticias((prev) => prev.filter((n) => n._id !== id))

  const handleUpdated = (updated) =>
    setNoticias((prev) => prev.map((n) => (n._id === updated._id ? updated : n)))

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>◆ COMUNIDAD</div>
            <h1 className={styles.title}>Noticias</h1>
            <p className={styles.sub}>Novedades y eventos de la comunidad Turnocero.</p>
          </div>
          {isAdmin && (
            <button
              className={`${styles.newBtn} ${showCreate ? styles.newBtnActive : ''}`}
              onClick={() => setCreate((s) => !s)}
            >
              {showCreate ? '✕ Cancelar' : '+ Nueva noticia'}
            </button>
          )}
        </div>

        {showCreate && (
          <CreateForm onCreated={handleCreated} onCancel={() => setCreate(false)} />
        )}

        {loading ? (
          <div className={styles.skeletons}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeleton}>
                <div className={styles.skeletonImg} />
                <div className={styles.skeletonBody}>
                  <div className={styles.skeletonLine} style={{ width: '55%' }} />
                  <div className={styles.skeletonLine} style={{ width: '80%' }} />
                  <div className={styles.skeletonLine} style={{ width: '65%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : noticias.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📰</span>
            <p className={styles.emptyTitle}>Sin noticias todavía</p>
            {isAdmin && (
              <button className={styles.emptyBtn} onClick={() => setCreate(true)}>
                + Publicar noticia
              </button>
            )}
          </div>
        ) : (
          <div className={styles.feed}>
            {noticias.map((n) => (
              <NoticiaCard
                key={n._id}
                noticia={n}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
                isAdmin={isAdmin}
              />
            ))}

            {page < totalPages && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => load(page + 1, false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Cargando…' : 'Ver más noticias'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
