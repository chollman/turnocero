import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import axios from 'axios'
import CompartidaCard from './CompartidaCard'
import CompartidasSidebar from './CompartidasSidebar'
import CompartidaSkeleton from './CompartidaSkeleton'
import styles from './CompartidaPost.module.css'

export default function CompartidaPost() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`/api/compartidas/${id}`)
      .then(({ data }) => setPost(data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Esta compartida no existe o fue eliminada.')
        else if (err.response?.status === 403) setError('No tenés acceso a esta compartida.')
        else setError('Error al cargar la compartida.')
      })
      .finally(() => setLoading(false))
  }, [id])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const postUrl = `${origin}/compartidas/${id}`
  const authorName = post?.author
    ? (post.author.displayName || post.author.username)
    : 'Turnocero'
  const metaTitle = post?.title
    ? `${post.title} – Turnocero 🎲`
    : `Compartida de ${authorName} – Turnocero 🎲`
  const metaDesc = post?.body
    ? post.body.slice(0, 160) + (post.body.length > 160 ? '…' : '')
    : 'Mirá esta compartida en Turnocero, la comunidad de juegos de mesa.'
  const rawImage = post?.images?.[0]?.url
  // Resize to 1200×630 via Cloudinary transformation for optimal OG display
  const metaImage = rawImage
    ? rawImage.replace('/upload/', '/upload/w_1200,h_630,c_fill,g_auto/')
    : `${origin}/og-default.png`
  const hasImage = Boolean(rawImage)

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />

        {/* Open Graph */}
        <meta property="og:type"             content="article" />
        <meta property="og:title"            content={metaTitle} />
        <meta property="og:description"      content={metaDesc} />
        <meta property="og:url"              content={postUrl} />
        <meta property="og:locale"           content="es_AR" />
        <meta property="og:site_name"        content="Turnocero" />
        <meta property="og:image"            content={metaImage} />
        <meta property="og:image:secure_url" content={metaImage} />
        <meta property="og:image:width"      content="1200" />
        <meta property="og:image:height"     content="630" />
        <meta property="og:image:alt"        content={metaTitle} />

        {/* Twitter / X */}
        <meta name="twitter:card"        content={hasImage ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title"       content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image"       content={metaImage} />
        <meta name="twitter:image:alt"   content={metaTitle} />
      </Helmet>

      <div className={styles.layout}>
        <div className={styles.feedCol}>
          <button className={styles.backBtn} onClick={() => navigate('/compartidas')}>
            ← Volver al feed
          </button>

          {loading && <CompartidaSkeleton />}

          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
              <button className={styles.backLink} onClick={() => navigate('/compartidas')}>
                Ir al feed de Compartidas
              </button>
            </div>
          )}

          {post && (
            <CompartidaCard
              post={post}
              onDeleted={() => navigate('/compartidas')}
              onUpdated={(updated) => setPost(updated)}
            />
          )}
        </div>
        <CompartidasSidebar />
      </div>
    </div>
  )
}
