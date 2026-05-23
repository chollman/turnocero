import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../api/endpoints'
import styles from './NoticiaDetail.module.css'

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000
  if (diff < 60)     return 'ahora'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const SHARE_URL = (id) =>
  typeof window !== 'undefined' ? `${window.location.origin}/noticias/${id}` : `/noticias/${id}`

export default function NoticiaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.isAdmin

  const [noticia, setNoticia]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    axios.get(API.noticias.DETAIL(id), { signal: ac.signal })
      .then(({ data }) => { if (!ac.signal.aborted) setNoticia(data) })
      .catch((err) => {
        if (axios.isCancel(err)) return
        if (err.response?.status === 404) setNotFound(true)
      })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [id])

  const handleCopy = () => {
    navigator.clipboard.writeText(SHARE_URL(id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta noticia?')) return
    try {
      await axios.delete(API.noticias.DETAIL(id))
      navigate('/noticias')
    } catch { /* silently ignore */ }
  }

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonImg} />
          <div className={styles.skeletonBody}>
            {[60, 85, 70].map((w, i) => (
              <div key={i} className={styles.skeletonLine} style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  if (notFound) return (
    <div className={styles.page}>
      <div className={styles.notFound}>
        <p className={styles.notFoundTitle}>Noticia no encontrada</p>
        <Link to="/noticias" className={styles.backLink}>← Volver a Noticias</Link>
      </div>
    </div>
  )

  if (!noticia) return null

  const url         = SHARE_URL(id)
  const shareTitle  = noticia.title || 'Turnocero — Noticias'
  const shareDesc   = noticia.body?.slice(0, 200) || 'Novedades y eventos de la comunidad Turnocero.'
  const waText      = encodeURIComponent(`${shareTitle}\n${url}`)
  const tgText      = encodeURIComponent(shareTitle)
  const twText      = encodeURIComponent(shareTitle)

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{shareTitle} – Turnocero 🎲</title>
        <meta name="description"          content={shareDesc} />
        <meta property="og:title"         content={`${shareTitle} – Turnocero 🎲`} />
        <meta property="og:description"   content={shareDesc} />
        <meta property="og:url"           content={url} />
        <meta property="og:type"          content="article" />
        {noticia.image?.url && <meta property="og:image" content={noticia.image.url} />}
        <meta name="twitter:card"         content="summary_large_image" />
        <meta name="twitter:title"        content={`${shareTitle} – Turnocero 🎲`} />
        <meta name="twitter:description"  content={shareDesc} />
        {noticia.image?.url && <meta name="twitter:image" content={noticia.image.url} />}
      </Helmet>

      <div className={styles.inner}>
        {/* ── Back nav ── */}
        <Link to="/noticias" className={styles.backLink}>← Noticias</Link>

        <article className={styles.card}>
          {/* ── Image ── */}
          {noticia.image?.url && (
            <>
              <button
                className={styles.imageBtn}
                onClick={() => setLightbox(true)}
                aria-label="Ver imagen completa"
              >
                <img src={noticia.image.url} alt=""                          className={styles.imageBg} aria-hidden="true" />
                <img src={noticia.image.url} alt={noticia.title || 'Noticia'} className={styles.image} />
              </button>
            </>
          )}

          <div className={styles.body}>
            {/* ── Meta ── */}
            <div className={styles.meta}>
              <span className={styles.date}>{timeAgo(noticia.createdAt)}</span>
              {isAdmin && (
                <div className={styles.adminActions}>
                  <Link to={`/noticias/${id}/editar`} className={styles.editBtn}>Editar</Link>
                  <button className={styles.deleteBtn} onClick={handleDelete}>Eliminar</button>
                </div>
              )}
            </div>

            {/* ── Content ── */}
            {noticia.title && <h1 className={styles.title}>{noticia.title}</h1>}
            {noticia.body  && <p  className={styles.text}>{noticia.body}</p>}

            {noticia.link && (
              <a href={noticia.link} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                {noticia.linkLabel || 'Ver más →'}
              </a>
            )}

            {/* ── Share ── */}
            <div className={styles.shareSection}>
              <span className={styles.shareLabel}>Compartir</span>
              <div className={styles.shareButtons}>
                {/* WhatsApp */}
                <a
                  className={styles.shareBtn}
                  href={`https://api.whatsapp.com/send?text=${waText}`}
                  target="_blank" rel="noopener noreferrer"
                  title="Compartir en WhatsApp"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>

                {/* Telegram */}
                <a
                  className={styles.shareBtn}
                  href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${tgText}`}
                  target="_blank" rel="noopener noreferrer"
                  title="Compartir en Telegram"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z"/>
                  </svg>
                  <span>Telegram</span>
                </a>

                {/* Twitter / X */}
                <a
                  className={styles.shareBtn}
                  href={`https://twitter.com/intent/tweet?text=${twText}&url=${encodeURIComponent(url)}`}
                  target="_blank" rel="noopener noreferrer"
                  title="Compartir en X"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span>X</span>
                </a>

                {/* Copy link */}
                <button
                  className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ''}`}
                  onClick={handleCopy}
                  title={copied ? '¡Copiado!' : 'Copiar enlace'}
                >
                  {copied
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  }
                  <span>{copied ? '¡Copiado!' : 'Copiar link'}</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <img src={noticia.image.url} alt={noticia.title || ''} className={styles.lightboxImg} />
          <button className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </div>
  )
}
