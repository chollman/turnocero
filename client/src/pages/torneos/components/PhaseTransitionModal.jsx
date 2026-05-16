import { useState, useEffect } from 'react'
import axios from 'axios'
import styles from '../TorneoDetail.module.css'

export default function PhaseTransitionModal({ torneoId, onClose, onGenerated }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSub]  = useState(false)
  const [error, setError]     = useState('')
  const [overrideTableSize, setOverride] = useState(null)

  useEffect(() => {
    axios.get(`/api/torneos/${torneoId}/next-phase/preview`)
      .then(({ data }) => setPreview(data))
      .catch((err) => setError(err.response?.data?.message || 'Error al calcular la vista previa'))
      .finally(() => setLoading(false))
  }, [torneoId])

  const submit = async (tableSize) => {
    setSub(true); setError('')
    try {
      await axios.post(`/api/torneos/${torneoId}/next-phase`, tableSize ? { tableSize } : {})
      onGenerated()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al generar la siguiente fase')
    } finally {
      setSub(false)
    }
  }

  if (loading) return null

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Generar siguiente fase</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {preview && (
          <div className={styles.phasePreview}>
            <div className={styles.phasePreviewRow}>
              <span className={styles.phasePreviewLabel}>Promovidos</span>
              <span className={styles.phasePreviewValue}>{preview.advancersCount}</span>
            </div>
            <div className={styles.phasePreviewRow}>
              <span className={styles.phasePreviewLabel}>Tamaño de mesa configurado</span>
              <span className={styles.phasePreviewValue}>{preview.defaultTableSize}</span>
            </div>

            {preview.valid ? (
              preview.isFinal ? (
                <p className={styles.phasePreviewNote}>🏁 Esta será la <strong>mesa final</strong> con {preview.finalTableSize} jugadores.</p>
              ) : (
                <p className={styles.phasePreviewNote}>
                  Se generarán <strong>{preview.tables} mesas de {preview.finalTableSize}</strong>.
                </p>
              )
            ) : (
              <>
                <p className={styles.phasePreviewWarning}>
                  ⚠ {preview.warnings?.join(' ')} Elegí cómo armar la fase:
                </p>
                <div className={styles.phaseSuggestions}>
                  {(preview.suggestions || []).map((s, idx) => (
                    <button
                      key={idx}
                      className={`${styles.phaseSuggestion} ${overrideTableSize === s.overrideTableSize ? styles.phaseSuggestionActive : ''}`}
                      onClick={() => setOverride(s.overrideTableSize)}
                      disabled={submitting}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose} disabled={submitting}>Cancelar</button>
          <button
            className={styles.btnPrimary}
            onClick={() => submit(preview?.valid ? null : overrideTableSize)}
            disabled={submitting || (!preview?.valid && !overrideTableSize)}
          >
            {submitting ? 'Generando…' : 'Generar fase'}
          </button>
        </div>
      </div>
    </div>
  )
}
