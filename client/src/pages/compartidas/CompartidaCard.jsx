import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import { useSiteConfig } from '../../context/SiteConfigContext'
import GameTile from '../../components/shared/GameTile'
import LoginPromptModal from '../../components/shared/LoginPromptModal'
import { GhostIcon } from '../../components/shared/UserRef'
import { getUserDisplay } from '../../utils/userDisplay'
import styles from './CompartidaCard.module.css'

function buildShareData(post) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/compartidas/${post._id}`
  const parts = []
  if (post.title) parts.push(`*${post.title}*`)
  if (post.body)  parts.push(post.body.slice(0, 180) + (post.body.length > 180 ? '…' : ''))
  parts.push(`🎲 ${url}`)
  const text = parts.join('\n')
  return { url, text }
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000
  if (diff < 60)    return 'ahora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800)return `${Math.floor(diff / 86400)}d`
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

// Small inline link rendered next to the author's name when they have an active
// BG Watch (i.e. populated `bggUsername`). Click → their BG Watch profile.
function AuthorBgWatchLink({ author, enabled }) {
  if (!enabled) return null
  if (!author?.bggUsername) return null
  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(author.bggUsername)}`}
      className={styles.authorBgWatchLink}
      title={`Ver historial de partidas de @${author.username}`}
      aria-label={`Ver BG Watch de ${author.username}`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    </Link>
  )
}

function formatTableDate(date) {
  return new Date(date).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const PRIVACY_LABELS = { public: null, friends: 'Amigos', private: 'Solo yo' }

export default function CompartidaCard({ post: initialPost, onDeleted, onUpdated, featured }) {
  const { user } = useAuth()
  const { isSectionEnabled } = useSiteConfig()
  const mesasEnabled = isSectionEnabled('mesas')
  const bgwatchEnabled = isSectionEnabled('bgwatch')
  const [post, setPost] = useState(initialPost)
  const [liked, setLiked] = useState(() =>
    user ? initialPost.likes.some((l) => (l._id || l).toString() === user._id.toString()) : false
  )
  const [heartPopping, setHeartPopping] = useState(false)
  const [loginPrompt, setLoginPrompt] = useState('')
  const [likeCount, setLikeCount] = useState(initialPost.likes.length)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentCount, setCommentCount] = useState(initialPost.commentCount ?? 0)
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
  const [copied, setCopied] = useState(false)
  const menuRef = useRef(null)
  const commentInputRef = useRef(null)

  const authorInfo = getUserDisplay(post.author)
  const isAuthor = user && post.author && (
    post.author._id?.toString() === user._id.toString() ||
    post.author.toString?.() === user._id.toString()
  )

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLike = async () => {
    if (!user) { setLoginPrompt('Iniciá sesión para dar like a esta compartida.'); return }
    const prev = liked
    setLiked(!liked)
    setLikeCount((c) => c + (liked ? -1 : 1))
    if (!prev) {
      setHeartPopping(true)
      setTimeout(() => setHeartPopping(false), 350)
    }
    try {
      await axios.post(`/api/compartidas/${post._id}/like`)
    } catch {
      setLiked(prev)
      setLikeCount((c) => c + (prev ? 1 : -1))
    }
  }

  const toggleComments = async () => {
    if (!showComments && !commentsLoaded) {
      setShowComments(true)
      setLoadingComments(true)
      try {
        const { data } = await axios.get(`/api/compartidas/${post._id}/comments`)
        setComments(data)
        setCommentsLoaded(true)
        setCommentCount(data.length)
      } catch { /* silently ignore */ } finally {
        setLoadingComments(false)
      }
    } else {
      setShowComments((s) => !s)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentInput.trim() || submitting) return
    setSubmitting(true)
    try {
      const { data } = await axios.post(`/api/compartidas/${post._id}/comments`, { content: commentInput.trim() })
      setComments((c) => [...c, data])
      setCommentCount((n) => n + 1)
      setCommentInput('')
    } catch { /* silently ignore */ } finally {
      setSubmitting(false)
    }
  }

  const handleEditComment = async (cid) => {
    if (!editContent.trim()) return
    try {
      const { data } = await axios.put(`/api/compartidas/${post._id}/comments/${cid}`, { content: editContent.trim() })
      setComments((cs) => cs.map((c) => (c._id === cid ? data : c)))
      setEditingCid(null)
    } catch { /* silently ignore */ }
  }

  const handleDeleteComment = async (cid) => {
    try {
      await axios.delete(`/api/compartidas/${post._id}/comments/${cid}`)
      setComments((cs) => cs.filter((c) => c._id !== cid))
      setCommentCount((n) => Math.max(0, n - 1))
    } catch { /* silently ignore */ }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta compartida?')) return
    try {
      await axios.delete(`/api/compartidas/${post._id}`)
      onDeleted?.(post._id)
    } catch { /* silently ignore */ }
  }

  const handleSaveEdit = async () => {
    try {
      const { data } = await axios.put(`/api/compartidas/${post._id}`, {
        title: editTitle, body: editBody, privacy: editPrivacy,
      })
      const updated = { ...post, title: data.title, body: data.body, privacy: data.privacy }
      setPost(updated)
      onUpdated?.(updated)
      setEditing(false)
    } catch { /* silently ignore */ }
  }

  const table = mesasEnabled ? post.linkedTable : null
  const tableSeats = table ? table.maxPlayers - (table.players?.length || 0) : 0
  const tableOpen = table?.status === 'open'
  const bodyLong = post.body.length > 220
  const displayBody = expanded || !bodyLong ? post.body : `${post.body.slice(0, 220)}…`
  const authorName = authorInfo.name
  const privacyLabel = PRIVACY_LABELS[post.privacy]

  return (
    <>
      <LoginPromptModal isOpen={!!loginPrompt} onClose={() => setLoginPrompt('')} message={loginPrompt} />
      <article className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
        {featured && (
          <div className={styles.featuredBadge}>🔥 Compartida del día</div>
        )}

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.avatar}>
            {authorInfo.isDeleted ? <GhostIcon size={16} /> : authorName[0].toUpperCase()}
          </div>
          <div className={styles.authorMeta}>
            <div className={styles.authorNameRow}>
              <span className={styles.authorName}>{authorName}</span>
              {!authorInfo.isDeleted && <AuthorBgWatchLink author={post.author} enabled={bgwatchEnabled} />}
            </div>
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
              placeholder="¿Cómo estuvo la compartida?"
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
              to={`/mesas/${table._id}`}
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
            <span className={`${styles.likeHeart} ${heartPopping ? styles.likeHeartPop : ''}`}>❤</span>
            <span>{likeCount}</span>
          </button>
          <button className={styles.commentToggle} onClick={toggleComments}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{commentCount} {commentCount === 1 ? 'comentario' : 'comentarios'}</span>
          </button>

          <div className={styles.shareGroup}>
            {/* WhatsApp */}
            <a
              className={styles.shareBtn}
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(buildShareData(post).text)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en WhatsApp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </a>

            {/* Telegram */}
            <a
              className={styles.shareBtn}
              href={`https://t.me/share/url?url=${encodeURIComponent(buildShareData(post).url)}&text=${encodeURIComponent(buildShareData(post).text)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en Telegram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z"/>
              </svg>
            </a>

            {/* Twitter / X */}
            <a
              className={styles.shareBtn}
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${post.title || post.body?.slice(0, 100) || 'Compartida en TurnoCero'} 🎲`)}&url=${encodeURIComponent(buildShareData(post).url)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en X (Twitter)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>

            {/* Copy link */}
            <button
              className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ''}`}
              onClick={() => {
                navigator.clipboard.writeText(buildShareData(post).url)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              title={copied ? '¡Copiado!' : 'Copiar enlace'}
            >
              {copied
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              }
            </button>
          </div>
        </div>

        {/* ── Comments ── */}
        {showComments && (
          <div className={styles.comments}>
            {loadingComments ? (
              <div className={styles.commentsLoader}>
                <span className={styles.commentsLoaderDot} />
                <span className={styles.commentsLoaderDot} />
                <span className={styles.commentsLoaderDot} />
              </div>
            ) : comments.length === 0 ? (
              <p className={styles.noComments}>Sin comentarios aún. ¡Sé el primero!</p>
            ) : null}
            {comments.map((c) => {
              const cAuthorInfo = getUserDisplay(c.author)
              const isOwn = user && c.author && (c.author._id || c.author).toString() === user._id.toString()
              const canDel = isOwn || isAuthor || user?.isAdmin
              return (
                <div key={c._id} className={styles.comment}>
                  <div className={styles.commentAvatar}>
                    {cAuthorInfo.isDeleted ? <GhostIcon size={14} /> : cAuthorInfo.name[0].toUpperCase()}
                  </div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>{cAuthorInfo.name}</span>
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

            {user ? (
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
            ) : (
              <button
                className={styles.commentSubmit}
                style={{ width: '100%', borderRadius: 8, padding: '8px 0' }}
                onClick={() => setLoginPrompt('Iniciá sesión para comentar en esta compartida.')}
                type="button"
              >
                Iniciá sesión para comentar
              </button>
            )}
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
