import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import axios from 'axios'
import JuntadaCard from '../components/JuntadaCard'
import styles from './JuntadaPost.module.css'

export default function JuntadaPost() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`/api/juntadas/${id}`)
      .then(({ data }) => setPost(data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Esta juntada no existe o fue eliminada.')
        else if (err.response?.status === 403) setError('No tenés acceso a esta juntada.')
        else setError('Error al cargar la juntada.')
      })
      .finally(() => setLoading(false))
  }, [id])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const postUrl = `${origin}/juntadas/${id}`
  const authorName = post ? (post.author.displayName || post.author.username) : 'Turnocero'
  const metaTitle = post?.title
    ? `${post.title} – Turnocero 🎲`
    : `Juntada de ${authorName} – Turnocero 🎲`
  const metaDesc = post?.body
    ? post.body.slice(0, 160) + (post.body.length > 160 ? '…' : '')
    : 'Mirá esta juntada en Turnocero, la comunidad de juegos de mesa.'
  const metaImage = post?.images?.[0]?.url || `${origin}/og-default.png`

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />

        {/* Open Graph */}
        <meta property="og:type"        content="article" />
        <meta property="og:title"       content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:image"       content={metaImage} />
        <meta property="og:url"         content={postUrl} />
        <meta property="og:locale"      content="es_AR" />
        <meta property="og:site_name"   content="Turnocero" />

        {/* Twitter / X */}
        <meta name="twitter:card"        content={post?.images?.length ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title"       content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image"       content={metaImage} />
      </Helmet>

      <div className={styles.inner}>
        <button className={styles.backBtn} onClick={() => navigate('/juntadas')}>
          ← Volver al feed
        </button>

        {loading && (
          <div className={styles.spinner}>
            <span className={styles.spinnerDice}>🎲</span>
          </div>
        )}

        {error && (
          <div className={styles.errorBox}>
            <p>{error}</p>
            <button className={styles.backLink} onClick={() => navigate('/juntadas')}>
              Ir al feed de Juntadas
            </button>
          </div>
        )}

        {post && (
          <JuntadaCard
            post={post}
            onDeleted={() => navigate('/juntadas')}
            onUpdated={(updated) => setPost(updated)}
          />
        )}
      </div>
    </div>
  )
}
