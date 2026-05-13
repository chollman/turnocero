import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import JuntadaCard from '../components/JuntadaCard'
import CreateJuntadaForm from '../components/CreateJuntadaForm'
import JuntadasSidebar from '../components/JuntadasSidebar'
import styles from './Juntadas.module.css'

export default function Juntadas() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const prefilledMesa = searchParams.get('mesa') || ''

  const [posts, setPosts] = useState([])
  const [featured, setFeatured] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showCreate, setShowCreate] = useState(!!prefilledMesa)

  const loadFeed = useCallback(async (pageNum = 1, replace = true) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const { data } = await axios.get('/api/juntadas', { params: { page: pageNum, limit: 10 } })
      setPosts((prev) => replace ? data.juntadas : [...prev, ...data.juntadas])
      setTotalPages(data.pages)
      setPage(pageNum)
      if (pageNum === 1 && data.featured) setFeatured(data.featured)
    } catch { /* silently ignore */ } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { loadFeed(1) }, [loadFeed])

  const handleCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev])
    setShowCreate(false)
  }

  const handleDeleted = (id) => {
    setPosts((prev) => prev.filter((p) => p._id !== id))
    if (featured?._id === id) setFeatured(null)
  }

  const handleUpdated = (updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)))
    if (featured?._id === updated._id) setFeatured(updated)
  }

  const pageUrl = typeof window !== 'undefined' ? `${window.location.origin}/juntadas` : '/juntadas'

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Juntadas – Turnocero 🎲</title>
        <meta name="description" content="Mirá las últimas juntadas de la comunidad de juegos de mesa." />
        <meta property="og:title"       content="Juntadas – Turnocero 🎲" />
        <meta property="og:description" content="Mirá las últimas juntadas de la comunidad de juegos de mesa." />
        <meta property="og:url"         content={pageUrl} />
        <meta property="og:type"        content="website" />
        <meta name="twitter:title"       content="Juntadas – Turnocero 🎲" />
        <meta name="twitter:description" content="Mirá las últimas juntadas de la comunidad de juegos de mesa." />
      </Helmet>
      <div className={styles.layout}>
      <div className={styles.feedCol}>
        {/* ── Page header ── */}
        <div className={styles.pageHeader}>
          <div className={styles.heroBlock}>
            <div className={styles.eyebrow}>◆ COMUNIDAD</div>
            <h1 className={styles.heroTitle}>Juntadas</h1>
            <p className={styles.heroSub}>Compartí tus partidas, fotos y momentos con la comunidad.</p>
          </div>
          {user && (
            <button
              className={`${styles.newBtn} ${showCreate ? styles.newBtnActive : ''}`}
              onClick={() => setShowCreate((s) => !s)}
            >
              {showCreate ? '✕ Cancelar' : '+ Nueva juntada'}
            </button>
          )}
        </div>

        {/* ── Create form ── */}
        {showCreate && (
          <CreateJuntadaForm
            onCreated={handleCreated}
            onCancel={() => setShowCreate(false)}
            prefilledTableId={prefilledMesa}
          />
        )}

        {/* ── Feed ── */}
        {loading ? (
          <div className={styles.spinner}>
            <span className={styles.spinnerDice}>🎲</span>
            <span className={styles.spinnerText}>Cargando juntadas…</span>
          </div>
        ) : posts.length === 0 && !featured ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🎲</span>
            <p className={styles.emptyTitle}>No hay juntadas todavía</p>
            <p className={styles.emptySub}>{user ? '¡Sé el primero en compartir tu partida!' : 'Registrate para compartir tus partidas.'}</p>
            {user && (
              <button className={styles.emptyBtn} onClick={() => setShowCreate(true)}>
                + Publicar juntada
              </button>
            )}
          </div>
        ) : (
          <div className={styles.feed}>
            {featured && (
              <JuntadaCard
                key={`featured-${featured._id}`}
                post={featured}
                featured
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
            )}
            {posts
              .filter((p) => !featured || p._id !== featured._id)
              .map((post) => (
                <JuntadaCard
                  key={post._id}
                  post={post}
                  onDeleted={handleDeleted}
                  onUpdated={handleUpdated}
                />
              ))}

            {page < totalPages && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => loadFeed(page + 1, false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Cargando…' : 'Ver más juntadas'}
              </button>
            )}
          </div>
        )}
      </div>
      <JuntadasSidebar />
      </div>
    </div>
  )
}
