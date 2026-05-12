import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import styles from './CreateJuntadaForm.module.css'

const PRIVACY_OPTIONS = [
  { value: 'public',  label: 'Público',  desc: 'Todos' },
  { value: 'friends', label: 'Amigos',   desc: 'Solo amigos' },
  { value: 'private', label: 'Solo yo',  desc: 'Privado' },
]

export default function CreateJuntadaForm({ onCreated, onCancel, prefilledTableId }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [linkedTableId, setLinkedTableId] = useState(prefilledTableId || '')
  const [myTables, setMyTables] = useState([])
  const [images, setImages] = useState([]) // [{ file, preview }]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    axios.get('/api/tables/mine').then(({ data }) => {
      const active = (data.tables || []).filter((t) => t.status !== 'cancelled')
      setMyTables(active)
    }).catch(() => {})
  }, [])

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const remaining = 3 - images.length
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...toAdd])
    e.target.value = ''
  }

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() && !body.trim() && images.length === 0) {
      setError('Agregá al menos un título, texto o foto.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { data: created } = await axios.post('/api/juntadas', {
        title: title.trim(),
        body: body.trim(),
        privacy,
        linkedTable: linkedTableId || undefined,
      })

      let finalPost = created
      for (const img of images) {
        const fd = new FormData()
        fd.append('image', img.file)
        const { data: updatedImages } = await axios.post(
          `/api/juntadas/${created._id}/images`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        finalPost = { ...finalPost, images: updatedImages }
      }

      images.forEach((img) => URL.revokeObjectURL(img.preview))
      onCreated?.(finalPost)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al publicar la juntada')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = (title.trim() || body.trim() || images.length > 0) && !loading

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <div className={styles.avatar}>{user.username[0].toUpperCase()}</div>
        <span className={styles.prompt}>¿Cómo estuvo la juntada?</span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <input
        className={styles.titleInput}
        placeholder="Título (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        disabled={loading}
      />

      <textarea
        className={styles.bodyInput}
        placeholder="Contá cómo salió, qué jugaron, anécdotas…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        disabled={loading}
      />

      {/* Image previews */}
      {images.length > 0 && (
        <div className={styles.previews}>
          {images.map((img, i) => (
            <div key={i} className={styles.previewWrap}>
              <img src={img.preview} alt="" className={styles.preview} />
              <button
                type="button"
                className={styles.removeImg}
                onClick={() => removeImage(i)}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.controls}>
        {/* Photo picker */}
        <button
          type="button"
          className={styles.photoBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= 3 || loading}
          title={images.length >= 3 ? 'Máximo 3 fotos' : 'Agregar foto'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Foto {images.length > 0 ? `(${images.length}/3)` : ''}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className={styles.fileInput}
          onChange={handleImageSelect}
        />

        {/* Linked table picker */}
        <select
          className={styles.tableSelect}
          value={linkedTableId}
          onChange={(e) => setLinkedTableId(e.target.value)}
          disabled={loading}
        >
          <option value="">Vincular mesa (opcional)</option>
          {myTables.map((t) => (
            <option key={t._id} value={t._id}>{t.boardGame}</option>
          ))}
        </select>
      </div>

      {/* Privacy */}
      <div className={styles.privacyRow}>
        <span className={styles.privacyLabel}>Visibilidad:</span>
        {PRIVACY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.privacyBtn} ${privacy === opt.value ? styles.privacyBtnActive : ''}`}
            onClick={() => setPrivacy(opt.value)}
            disabled={loading}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
          {loading ? 'Publicando…' : 'Publicar juntada'}
        </button>
      </div>
    </form>
  )
}
