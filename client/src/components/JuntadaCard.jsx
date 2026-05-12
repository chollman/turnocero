import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import GameTile from './GameTile'
import styles from './JuntadaCard.module.css'

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000
  if (diff < 60)    return 'ahora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800)return `${Math.floor(diff / 86400)}d`
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function formatTableDate(date) {
  return new Date(date).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const PRIVACY_LABELS = { public: null, friends: 'Amigos', private: 'Solo yo' }

export default function JuntadaCard({ post: initialPost, onDeleted, onUpdated, featured }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState(initialPost)
  const [liked, setLiked] = useState(() =>
    initialPost.likes.some((l) => (l._id || l).toString() === user._id.toString())
  )
  const [likeCount, setLikeCount] = useState(initialPost.likes.length)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingCid, setEditingCid] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(post.title)
  const [editBody, setEditBody] = useState(post.body)
  const [editPrivacy, setEditPrivacy] = useState(post.privacy)
  const [lightbox, setLightbox] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const menuRef = useRef(null)
  const commentInputRef = useRef(null)

  const isAuthor = post.author._id?.toString() === user._id.toString() ||
                   post.author.toString?.() === user._id.toString()

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLike = async () => {
    const prev = liked
    setLiked(!liked)
    setLikeCount((c) => c + (liked ? -1 : 1))
    try {
      await axios.post(`/api/juntadas/${post._id}/like`)
    } catch {
      setLiked(prev)
      setLikeCount((c) => c + (prev ? 1 : -1))
    }
  }

  const toggleComments = async () => {
    if (!showComments && !commentsLoaded) {
      try {
        const { data } = await axios.get(`/api/juntadas/${post._id}/comments`)
        setComments(data)
        setCommentsLoaded(true)
      } catch { /* silently ignore */ }
    }
    setShowComments((s) => !s)
    if (!showComments) setTimeout(() => commentInputRef.current?.focus(), 100)
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentInput.trim() || submitting) return
    setSubmitting(true)
    try {
      const { data } = await axios.post(`/api/juntadas/${post._id}/comments`, { content: commentInput.trim() })
      setComments((c) => [...c, data])
      setCommentInput('')
    } catch { /* silently ignore */ } finally {
      setSubmitting(false)
    }
  }

  const handleEditComment = async (cid) => {
    if (!editContent.trim()) return
    try {
      const { data } = await axios.put(`/api/juntadas/${post._id}/comments/${cid}`, { content: editContent.trim() })
      setComments((cs) => cs.map((c) => (c._id === cid ? data : c)))
      setEditingCid(null)
    } catch { /* silently ignore */ }
  }

  const handleDeleteComment = async (cid) => {
    try {
      await axios.delete(`/api/juntadas/${post._id}/comments/${cid}`)
      setComments((cs) => cs.filter((c) => c._id !== cid))
    } catch { /* silently ignore */ }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta juntada?')) return
    try {
      await axios.delete(`/api/juntadas/${post._id}`)
      onDeleted?.(post._id)
    } catch { /* silently ignore */ }
  }

  const handleSaveEdit = async () => {
    try {
      const { data } = await axios.put(`/api/juntadas/${post._id}`, {
        title: editTitle, body: editBody, privacy: editPrivacy,
      })
      const updated = { ...post, title: data.title, body: data.body, privacy: data.privacy }
      setPost(updated)
      onUpdated?.(updated)
      setEditing(false)
    } catch { /* silently ignore */ }
  }

  const table = post.linkedTable
  const tableSeats = table ? table.maxPlayers - (table.players?.length || 0) : 0
  const tableOpen = table?.status === 'open'
  const bodyLong = post.body.length > 220
  const displayBody = expanded || !bodyLong ? post.body : post.body.slice(0, 220) + '…'
  const authorName = post.author.displayName || post.author.username
  const privacyLabel = PRIVACY_LABELS[post.privacy]

  return (
    <>
      <article className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
        {featured && (
          <div className={styles.featuredBadge}>🔥 Juntada del día</div>
        )}

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.avatar}>{authorName[0].toUpperCase()}</div>
          <div className={styles.authorMeta}>
            <span className={styles.authorName}>{authorName}</span>
            <span className={styles.meta}>
              {timeAgo(post.createdAt)}
              {privacyLabel && <span className={styles.privacyBadge}>{privacyLabel}</span>}
            </span>
          </div>
          {isAuthor && (
            <div className={styles.menuWrap} ref={menuRef}>
              <button className={styles.menuBtn} onClick={() => setMenuOpen((o) => !o)}>⋯</button>
              {menuOpen && (
                <div className={styles.menu}>
                  <button className={styles.menuItem} onClick={() => { setEditing(true); setMenuOpen(false) }}>Editar</button>
                  <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDelete}>Eliminar</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Edit form ── */}
        {editing ? (
          <div className={styles.editForm}>
            <input
              className={styles.editTitle}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título (opcional)"
              maxLength={100}
            />
            <textarea
              className={styles.editBody}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="¿Cómo estuvo la juntada?"
              rows={4}
              maxLength={2000}
            />
            <div className={styles.editPrivacyRow}>
              {['public', 'friends', 'private'].map((p) => (
                <button
                  key={p}
                  className={`${styles.privacyBtn} ${editPrivacy === p ? styles.privacyBtnActive : ''}`}
                  onClick={() => setEditPrivacy(p)}
                  type="button"
                >
                  {p === 'public' ? 'Público' : p === 'friends' ? 'Amigos' : 'Solo yo'}
                </button>
              ))}
            </div>
            <div className={styles.editActions}>
              <button className={styles.btnGhost} onClick={() => setEditing(false)}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSaveEdit}>Guardar</button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Content ── */}
            {post.title && <h3 className={styles.title}>{post.title}</h3>}
            {post.body && (
              <div className={styles.bodyWrap}>
                <p className={styles.body}>{displayBody}</p>
                {bodyLong && (
                  <button className={styles.expandBtn} onClick={() => setExpanded((e) => !e)}>
                    {expanded ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Photos ── */}
        {post.images.length > 0 && (
          <div className={`${styles.photos} ${styles[`photos${post.images.length}`]}`}>
            {post.images.map((img, i) => (
              <button
                key={img._id || i}
                className={styles.photoBtn}
                onClick={() => setLightbox(img.url)}
              >
                <img src={img.url} alt="" className={styles.photo} loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* ── Linked Mesa ── */}
        {table && (
          <div className={styles.mesaCard}>
            <div className={styles.mesaTile}>
              <GameTile game={table.boardGame} seed={table._id?.charCodeAt(0) || 42} size={44} />
            </div>
            <div className={styles.mesaInfo}>
              <span className={styles.mesaGame}>{table.boardGame}</span>
              <span className={styles.mesaMeta}>
                {formatTableDate(table.date)}
                {table.location ? ` · ${table.location}` : ''}
                {tableOpen && ` · ${tableSeats} lugar${tableSeats !== 1 ? 'es' : ''}`}
              </span>
            </div>
            <Link
              to={`/tables/${table._id}`}
              className={`${styles.mesaBtn} ${tableOpen ? styles.mesaBtnOpen : ''}`}
            >
              {tableOpen ? 'Unirse →' : 'Ver mesa →'}
            </Link>
          </div>
        )}

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button
            className={`${styles.likeBtn} ${liked ? styles.likeBtnActive : ''}`}
            onClick={handleLike}
          >
            <span className={styles.likeHeart}>❤</span>
            <span>{likeCount}</span>
          </button>
          <button className={styles.commentToggle} onClick={toggleComments}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{comments.length > 0 ? comments.length : commentsLoaded ? 0 : ''} comentarios</span>
          </button>
        </div>

        {/* ── Comments ── */}
        {showComments && (
          <div className={styles.comments}>
            {comments.length === 0 && (
              <p className={styles.noComments}>Sin comentarios aún. ¡Sé el primero!</p>
            )}
            {comments.map((c) => {
              const isOwn = (c.author._id || c.author).toString() === user._id.toString()
              const canDel = isOwn || isAuthor || user.isAdmin
              return (
                <div key={c._id} className={styles.comment}>
                  <div className={styles.commentAvatar}>{(c.author.displayName || c.author.username)[0].toUpperCase()}</div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>{c.author.displayName || c.author.username}</span>
                      <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
                      {c.editedAt && <span className={styles.editedBadge}>editado</span>}
                    </div>
                    {editingCid === c._id ? (
                      <div className={styles.inlineEdit}>
                        <textarea
                          className={styles.inlineEditArea}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          maxLength={500}
                        />
                        <div className={styles.inlineEditActions}>
                          <button className={styles.btnSave} onClick={() => handleEditComment(c._id)}>Guardar</button>
                          <button className={styles.btnGhost} onClick={() => setEditingCid(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.commentText}>{c.content}</p>
                    )}
                    {editingCid !== c._id && (
                      <div className={styles.commentActions}>
                        {isOwn && (
                          <button className={styles.commentActionBtn} onClick={() => { setEditingCid(c._id); setEditContent(c.content) }}>Editar</button>
                        )}
                        {canDel && (
                          <button className={`${styles.commentActionBtn} ${styles.commentActionDanger}`} onClick={() => handleDeleteComment(c._id)}>Eliminar</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            <form className={styles.commentForm} onSubmit={handleAddComment}>
              <div className={styles.commentFormAvatar}>{user.username[0].toUpperCase()}</div>
              <input
                ref={commentInputRef}
                className={styles.commentInput}
                placeholder="Escribí un comentario…"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                maxLength={500}
                disabled={submitting}
              />
              <button
                type="submit"
                className={styles.commentSubmit}
                disabled={!commentInput.trim() || submitting}
              >
                {submitting ? '…' : '↑'}
              </button>
            </form>
          </div>
        )}
      </article>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className={styles.lightboxImg} />
          <button className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </>
  )
}
