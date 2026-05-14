import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import GameTile from '../../components/shared/GameTile'
import LoginPromptModal from '../../components/shared/LoginPromptModal'
import styles from './TableDetail.module.css'

const REACTION_EMOJIS = ['❤️', '🎲', '🔥', '👍', '😄']

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function getDateChip(dateStr) {
  const date = new Date(dateStr)
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace(/\./g, '')
  const day = date.getDate()
  const month = date.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace(/\./g, '')
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${weekday} · ${day} ${month} · ${time}`
}

function SeatTrack({ filled, total }) {
  const pct = Math.min(100, (filled / total) * 100)
  return (
    <div className={styles.seatTrack}>
      <div className={styles.seatFill} style={{ width: `${pct}%` }} />
      {Array.from({ length: total - 1 }).map((_, i) => (
        <span key={i} className={styles.seatDivider} style={{ left: `${((i + 1) / total) * 100}%` }} />
      ))}
    </div>
  )
}

const LockIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/>
  </svg>
)

export default function TableDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { setActiveTable } = useNotifications()
  const navigate = useNavigate()

  const [table, setTable] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingTable, setLoadingTable] = useState(true)
  const [error, setError] = useState('')
  const [pendingRequests, setPendingRequests] = useState([])
  const [requestError, setRequestError] = useState('')
  const [requestLoading, setRequestLoading] = useState(null)

  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingContent, setEditingContent] = useState('')

  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [lightboxImage, setLightboxImage] = useState(null)
  const fileInputRef = useRef(null)

  const [ratings, setRatings] = useState([])
  const [ratingsAvg, setRatingsAvg] = useState(null)
  const [ratingsCount, setRatingsCount] = useState(0)
  const [myRatingScore, setMyRatingScore] = useState(0)
  const [myRatingComment, setMyRatingComment] = useState('')
  const [hoverScore, setHoverScore] = useState(0)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingError, setRatingError] = useState('')

  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [followLoading, setFollowLoading] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [cancelTableLoading, setCancelTableLoading] = useState(false)
  const [cancelTableError, setCancelTableError] = useState('')
  const [loginPrompt, setLoginPrompt] = useState('')
  const [accessError, setAccessError] = useState('')

  const [mobileTab, setMobileTab] = useState('chat')

  const socketRef = useRef(null)
  const messageListRef = useRef(null)

  const isParticipant = (t) => {
    if (!t || !user) return false
    const uid = user._id.toString()
    return (
      t.host._id?.toString() === uid ||
      t.players.some((p) => (p._id || p).toString() === uid)
    )
  }

  useEffect(() => {
    setActiveTable(id)
    return () => setActiveTable(null)
  }, [id, setActiveTable])

  useEffect(() => {
    const fetchTable = async () => {
      try {
        const { data } = await axios.get(`/api/tables/${id}`)
        if (data.privacy === 'private' && !isParticipant(data) && !user?.isAdmin) {
          navigate('/', { replace: true })
          return
        }
        setTable(data)
        setPendingRequests(data.pendingRequests || [])
      } catch (err) {
        if (err.response?.status === 403) {
          setAccessError('Esta mesa es privada')
        } else {
          navigate('/', { replace: true })
        }
      } finally {
        setLoadingTable(false)
      }
    }
    fetchTable()
  }, [id])

  useEffect(() => {
    if (!table) return
    axios.get(`/api/tables/${id}/messages`).then(({ data }) => setMessages(data))
  }, [table])

  useEffect(() => {
    if (!table) return
    axios.get(`/api/tables/${id}/comments`).then(({ data }) => setComments(data)).catch(() => {})
  }, [table])

  useEffect(() => {
    if (!table) return
    axios
      .get(`/api/tables/${id}/ratings`)
      .then(({ data }) => {
        setRatings(data.ratings)
        setRatingsAvg(data.avg)
        setRatingsCount(data.count)
        const mine = user && data.ratings.find(
          (r) => (r.rater._id || r.rater).toString() === user._id.toString()
        )
        if (mine) {
          setMyRatingScore(mine.score)
          setMyRatingComment(mine.comment || '')
        }
      })
      .catch(() => {})
  }, [table])

  useEffect(() => {
    if (!table || !user) return
    const token = localStorage.getItem('token')
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket
    socket.emit('join:table', id)
    socket.on('chat:message', (msg) => {
      setMessages((prev) => [...prev, msg])
    })
    return () => {
      socket.emit('leave:table', id)
      socket.disconnect()
    }
  }, [table, id, user])

  useEffect(() => {
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const handleRequest = async (userId, action) => {
    setRequestLoading(userId + action)
    setRequestError('')
    try {
      const { data } = await axios.post(`/api/tables/${id}/requests/${userId}/${action}`)
      setTable(data)
      setPendingRequests(data.pendingRequests || [])
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Error al procesar la solicitud')
    } finally {
      setRequestLoading(null)
    }
  }

  const handleFollow = async () => {
    if (!user) { setLoginPrompt('Iniciá sesión para seguir esta mesa.'); return }
    setFollowLoading(true)
    const currentFollowers = table.followers || []
    const isFollowing = currentFollowers.some((f) => f.toString() === user._id.toString())
    const newFollowers = isFollowing
      ? currentFollowers.filter((f) => f.toString() !== user._id.toString())
      : [...currentFollowers, user._id]
    setTable((prev) => ({ ...prev, followers: newFollowers }))
    try {
      const { data } = await axios.post(`/api/tables/${id}/follow`)
      setTable((prev) => ({ ...prev, followers: data.followers }))
    } catch {
      setTable((prev) => ({ ...prev, followers: currentFollowers }))
    } finally {
      setFollowLoading(false)
    }
  }

  const handleGuestJoin = async () => {
    if (!user) { setLoginPrompt('Iniciá sesión para unirte a esta mesa.'); return }
    setJoinLoading(true)
    setJoinError('')
    try {
      const { data } = await axios.post(`/api/tables/${id}/join`)
      setTable(data.table)
      setPendingRequests(data.table.pendingRequests || [])
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Error al unirse')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleLeave = async () => {
    if (!window.confirm('¿Abandonar esta mesa?')) return
    setLeaveLoading(true)
    setLeaveError('')
    try {
      await axios.post(`/api/tables/${id}/leave`)
      navigate('/')
    } catch (err) {
      setLeaveError(err.response?.data?.message || 'Error al abandonar la mesa')
      setLeaveLoading(false)
    }
  }

  const handleCancelTable = async () => {
    if (!window.confirm('¿Cancelar esta mesa? Esta acción no se puede deshacer.')) return
    setCancelTableLoading(true)
    try {
      await axios.delete(`/api/tables/${id}`)
      navigate('/')
    } catch (err) {
      setCancelTableError(err.response?.data?.message || 'Error al cancelar la mesa')
      setCancelTableLoading(false)
    }
  }

  const handleCancelJoinRequest = async () => {
    setJoinLoading(true)
    setJoinError('')
    try {
      const { data } = await axios.delete(`/api/tables/${id}/request`)
      setTable(data.table)
      setPendingRequests(data.table.pendingRequests || [])
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Error al cancelar solicitud')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleReact = async (emoji) => {
    if (!user) { setLoginPrompt('Iniciá sesión para reaccionar a esta mesa.'); return }
    const currentReactions = table.reactions || []
    const existing = currentReactions.find((r) => r.user?.toString() === user._id.toString())
    let newReactions
    if (existing) {
      if (existing.emoji === emoji) {
        newReactions = currentReactions.filter((r) => r.user?.toString() !== user._id.toString())
      } else {
        newReactions = currentReactions.map((r) =>
          r.user?.toString() === user._id.toString() ? { ...r, emoji } : r
        )
      }
    } else {
      newReactions = [...currentReactions, { user: user._id, emoji }]
    }
    setTable((prev) => ({ ...prev, reactions: newReactions }))
    try {
      const { data } = await axios.post(`/api/tables/${id}/react`, { emoji })
      setTable((prev) => ({ ...prev, reactions: data.reactions }))
    } catch {
      setTable((prev) => ({ ...prev, reactions: currentReactions }))
    }
  }

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImageError('')
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('image', file)
    try {
      const { data } = await axios.post(`/api/tables/${id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setTable((prev) => ({ ...prev, images: data }))
    } catch (err) {
      setImageError(err.response?.data?.message || 'Error al subir la imagen')
    } finally {
      setUploadingImage(false)
    }
  }, [id])

  const handleImageDelete = async (imageId) => {
    if (!window.confirm('¿Eliminar esta imagen?')) return
    setImageError('')
    try {
      await axios.delete(`/api/tables/${id}/images/${imageId}`)
      setTable((prev) => ({ ...prev, images: prev.images.filter((img) => img._id !== imageId) }))
    } catch (err) {
      setImageError(err.response?.data?.message || 'Error al eliminar la imagen')
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    const content = commentInput.trim()
    if (!content || submittingComment) return
    setSubmittingComment(true)
    setCommentError('')
    try {
      const { data } = await axios.post(`/api/tables/${id}/comments`, { content })
      setComments((prev) => [...prev, data])
      setCommentInput('')
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Error al comentar')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleEditComment = async (commentId) => {
    const content = editingContent.trim()
    if (!content) return
    setCommentError('')
    try {
      const { data } = await axios.put(`/api/tables/${id}/comments/${commentId}`, { content })
      setComments((prev) => prev.map((c) => (c._id === commentId ? data : c)))
      setEditingCommentId(null)
      setEditingContent('')
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Error al editar')
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('¿Eliminar este comentario?')) return
    setCommentError('')
    try {
      await axios.delete(`/api/tables/${id}/comments/${commentId}`)
      setComments((prev) => prev.filter((c) => c._id !== commentId))
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Error al eliminar')
    }
  }

  const handleSubmitRating = async (e) => {
    e.preventDefault()
    if (!myRatingScore || submittingRating) return
    setSubmittingRating(true)
    setRatingError('')
    try {
      const { data } = await axios.post(`/api/tables/${id}/ratings`, {
        score: myRatingScore,
        comment: myRatingComment,
      })
      setRatings((prev) => {
        const withoutMine = prev.filter(
          (r) => (r.rater._id || r.rater).toString() !== user._id.toString()
        )
        return [data.rating, ...withoutMine]
      })
      setRatingsAvg(data.avg)
      setRatingsCount(data.count)
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Error al enviar la valoración')
    } finally {
      setSubmittingRating(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')
    try {
      await axios.post(`/api/tables/${id}/messages`, { content })
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar el mensaje')
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  if (loadingTable) {
    return (
      <div className={styles.loadingWrapper}>
        <span className={styles.loadingDice}>🎲</span>
      </div>
    )
  }

  if (accessError) {
    return (
      <div className={styles.loadingWrapper}>
        <span style={{ fontSize: '2rem' }}>🔒</span>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>{accessError}</p>
        <button style={{ marginTop: '1rem', color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '14px' }} onClick={() => navigate('/')}>← Volver al inicio</button>
      </div>
    )
  }

  if (!table) return null

  const isAnon = !user
  const isHost = !isAnon && table.host._id?.toString() === user._id.toString()
  const isViewingAsAdmin = !isAnon && user.isAdmin && !isParticipant(table)
  const isGuest = !isParticipant(table) && !user?.isAdmin
  const isPlayer = isParticipant(table) && !isHost
  const isFull = table.players.length >= table.maxPlayers
  const isPendingRequest = !isAnon && (table.pendingRequests || []).some(
    (r) => (r._id || r).toString() === user._id.toString()
  )
  const isPrivate = table.privacy === 'private'
  const isFollowing = !isAnon && (table.followers || []).some((f) => f.toString() === user._id.toString())
  const filled = table.players.length + 1
  const total = table.maxPlayers + 1
  const availableSeats = table.maxPlayers - table.players.length
  const seed = hashStr(table._id || '') % 10

  const actionError = cancelTableError || leaveError || joinError

  const actionButtons = (
    <>
      {actionError && <p className={styles.actionError}>{actionError}</p>}
      {isHost && (
        <>
          <button className={styles.btnActEdit} onClick={() => navigate(`/mesas/${id}/editar`)} disabled={cancelTableLoading}>
            Editar mesa
          </button>
          <button className={styles.btnActCancel} onClick={handleCancelTable} disabled={cancelTableLoading}>
            {cancelTableLoading ? '…' : 'Cancelar mesa'}
          </button>
        </>
      )}
      {isPlayer && (
        <button className={styles.btnActLeave} onClick={handleLeave} disabled={leaveLoading}>
          {leaveLoading ? '…' : 'Abandonar mesa'}
        </button>
      )}
      {isGuest && isPendingRequest && (
        <button className={styles.btnActPending} onClick={handleCancelJoinRequest} disabled={joinLoading}>
          {joinLoading ? '…' : 'Solicitud enviada · Cancelar'}
        </button>
      )}
      {isGuest && !isAnon && !isPendingRequest && (
        <button className={styles.btnActJoin} onClick={handleGuestJoin} disabled={joinLoading || isFull}>
          {joinLoading ? '…' : isFull ? 'Mesa completa' : isPrivate ? 'Solicitar unirse' : 'Unirme a la mesa'}
        </button>
      )}
      {isAnon && !isFull && (
        <button className={styles.btnActJoin} onClick={() => setLoginPrompt('Iniciá sesión para unirte a esta mesa.')}>
          Unirme a la mesa
        </button>
      )}
      {isGuest && !isAnon && (
        <button
          className={`${styles.btnFollow} ${isFollowing ? styles.btnFollowing : ''}`}
          onClick={handleFollow}
          disabled={followLoading}
        >
          {isFollowing ? '🔔 Siguiendo' : '🔕 Seguir'}
        </button>
      )}
      {isAnon && (
        <button
          className={styles.btnFollow}
          onClick={() => setLoginPrompt('Iniciá sesión para seguir esta mesa.')}
        >
          🔕 Seguir
        </button>
      )}
      {(isHost || isPlayer) && (
        <button
          className={styles.btnShareCompartida}
          onClick={() => navigate(`/compartidas?mesa=${id}`)}
        >
          📸 Compartir compartida
        </button>
      )}
    </>
  )

  return (
    <>
    <LoginPromptModal isOpen={!!loginPrompt} onClose={() => setLoginPrompt('')} message={loginPrompt} />
    <div className={styles.page}>
      <div className="container">

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroTile}>
            <GameTile game={table.boardGame} seed={seed} size="100%" imageUrl={table.bggImage || null} />
          </div>
          <div className={styles.heroGradient} />

          <button className={styles.backBtn} onClick={() => navigate('/')}>
            ← Volver
          </button>

          <div className={styles.heroBadges}>
            {isHost && <span className={styles.hostBadge}>HOST</span>}
            {isPlayer && <span className={styles.playerBadge}>UNIDO</span>}
            {table.status === 'cancelled' && <span className={styles.cancelledBadge}>CANCELADA</span>}
            {isPrivate && <span className={styles.lockBadge}><LockIcon size={10} /></span>}
          </div>

          <div className={styles.heroMeta}>
            <h1 className={styles.heroGameTitle}>{table.boardGame}</h1>
            <div className={styles.heroChips}>
              <span className={styles.heroChip}>
                <span className={styles.heroChipDot}>●</span>
                {getDateChip(table.date)}
              </span>
              {table.location && (
                <span className={styles.heroChip}>📍 {table.location}</span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile meta rows — date + location below hero (mobile only) */}
        <div className={styles.mobileMetaRows}>
          <div className={styles.mobileMetaRow}>
            <span className={styles.mobileMetaIcon}>📅</span>
            <span>{getDateChip(table.date)}</span>
          </div>
          {table.location && (
            <div className={styles.mobileMetaRow}>
              <span className={styles.mobileMetaIcon}>📍</span>
              <span>{table.location}</span>
            </div>
          )}
        </div>

        {/* Actions bar */}
        {table.status !== 'cancelled' && (isHost || isPlayer || isGuest || isAnon) && (
          <div className={styles.actionsBar}>
            <div className={styles.actionsRow}>
              {actionButtons}
            </div>
          </div>
        )}

        {isViewingAsAdmin && (
          <div className={styles.adminBanner}>
            👁 Estás viendo esta mesa como administrador
          </div>
        )}

        {/* Content */}
        <div className={`${styles.content} ${isGuest ? styles.contentSingle : ''}`}>

          {/* Left column */}
          <div className={styles.mainCol}>

            {/* Seat track card */}
            <div className={styles.card}>
              <div className={styles.seatCardHeader}>
                <span className={styles.eyebrow}>LUGARES</span>
                <span className={styles.seatCount}>{filled}/{total}</span>
              </div>
              <SeatTrack filled={filled} total={total} />
              <span className={isFull ? styles.statusFull : styles.statusOpen}>
                ● {isFull
                  ? 'Mesa completa'
                  : `${availableSeats} lugar${availableSeats !== 1 ? 'es' : ''} libre${availableSeats !== 1 ? 's' : ''}`
                }
              </span>
            </div>

            {/* Description */}
            {table.description && (
              <div className={styles.card}>
                <span className={styles.eyebrow}>SOBRE LA PARTIDA</span>
                <p className={styles.descriptionText}>{table.description}</p>
              </div>
            )}

            {/* Reactions */}
            {(() => {
              const reactions = table.reactions || []
              const myReaction = user ? reactions.find((r) => r.user?.toString() === user._id.toString())?.emoji || null : null
              return (
                <div className={styles.card}>
                  <span className={styles.eyebrow}>¿QUÉ TE PARECE?</span>
                  <div className={styles.reactionBar}>
                    {REACTION_EMOJIS.map((emoji) => {
                      const count = reactions.filter((r) => r.emoji === emoji).length
                      return (
                        <button
                          key={`${emoji}-${myReaction === emoji}`}
                          className={`${styles.reactionBtn} ${myReaction === emoji ? styles.reactionActive : ''}`}
                          onClick={() => handleReact(emoji)}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className={styles.reactionCount}>{count}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* EN LA MESA */}
            <div className={styles.card}>
              <span className={styles.eyebrow}>EN LA MESA</span>
              <div className={styles.playerChips}>
                <div className={styles.playerChip}>
                  <span className={styles.playerChipAvatar}>{table.host.username[0].toUpperCase()}</span>
                  <span className={styles.playerChipName}>{table.host.username}</span>
                  <span className={styles.hostTag}>Host</span>
                </div>
                {table.players.map((p) => (
                  <div key={p._id || p} className={styles.playerChip}>
                    <span className={styles.playerChipAvatar}>{(p.username || '?')[0].toUpperCase()}</span>
                    <span className={styles.playerChipName}>{p.username}</span>
                    {user && (p._id || p).toString() === user._id.toString() && (
                      <span className={styles.youTag}>vos</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isGuest && (
              <p className={styles.chatPrivateNote}>
                El chat es privado y solo está disponible para los miembros.
              </p>
            )}

            {/* Pending requests — host only, private tables */}
            {isHost && isPrivate && (
              <div className={styles.card}>
                <div className={styles.requestsHeader}>
                  <span className={styles.eyebrow}>SOLICITUDES PENDIENTES</span>
                  {pendingRequests.length > 0 && (
                    <span className={styles.requestsBadge}>{pendingRequests.length}</span>
                  )}
                </div>
                {requestError && <p className={styles.requestsError}>{requestError}</p>}
                {pendingRequests.length === 0 ? (
                  <p className={styles.requestsEmpty}>No hay solicitudes pendientes.</p>
                ) : (
                  <ul className={styles.requestsList}>
                    {pendingRequests.map((req) => (
                      <li key={req._id} className={styles.requestItem}>
                        <span className={styles.requestAvatar}>{req.username[0].toUpperCase()}</span>
                        <span className={styles.requestUsername}>{req.username}</span>
                        <div className={styles.requestActions}>
                          <button className={styles.btnAccept} onClick={() => handleRequest(req._id, 'accept')} disabled={requestLoading !== null}>
                            {requestLoading === req._id + 'accept' ? '…' : 'Aceptar'}
                          </button>
                          <button className={styles.btnReject} onClick={() => handleRequest(req._id, 'reject')} disabled={requestLoading !== null}>
                            {requestLoading === req._id + 'reject' ? '…' : 'Rechazar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Mobile tab bar — participants only, hidden on desktop */}
            {!isGuest && (
              <div className={styles.mobileTabBar}>
                {[
                  { id: 'chat',    label: 'CHAT' },
                  { id: 'fotos',   label: 'FOTOS' },
                  { id: 'resenas', label: 'RESEÑAS' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    className={`${styles.mobileTabBtn} ${mobileTab === id ? styles.mobileTabActive : ''}`}
                    onClick={() => setMobileTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Gallery */}
            {(() => {
              const images = table.images || []
              const canUpload = isParticipant(table) && !isViewingAsAdmin && images.length < 10
              return (
                <div className={`${styles.card} ${!isGuest && mobileTab !== 'fotos' ? styles.mobileHidden : ''}`}>
                  <div className={styles.galleryHeader}>
                    <span className={styles.eyebrow}>
                      FOTOS DE LA MESA
                      {images.length > 0 && <span className={styles.galleryBadge}>{images.length}/10</span>}
                    </span>
                    {canUpload && (
                      <>
                        <button className={styles.btnUpload} onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                          {uploadingImage ? 'Subiendo…' : '+ Foto'}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          style={{ display: 'none' }}
                          onChange={handleImageUpload}
                        />
                      </>
                    )}
                  </div>
                  {imageError && <p className={styles.galleryError}>{imageError}</p>}
                  {images.length === 0 ? (
                    <p className={styles.galleryEmpty}>
                      {isParticipant(table) ? 'Todavía no hay fotos. ¡Subí la primera!' : 'Todavía no hay fotos.'}
                    </p>
                  ) : (
                    <div className={styles.imageGrid}>
                      {images.map((img) => {
                        const isUploader = user && (img.uploader?._id || img.uploader)?.toString() === user._id.toString()
                        const canDelete = isUploader || isHost || user?.isAdmin
                        return (
                          <div key={img._id} className={styles.imageThumb}>
                            <img
                              src={img.url}
                              alt="Foto de la mesa"
                              className={styles.thumbImg}
                              onClick={() => setLightboxImage(img.url)}
                            />
                            {canDelete && (
                              <button className={styles.btnDeleteImg} onClick={() => handleImageDelete(img._id)} title="Eliminar imagen">
                                ✕
                              </button>
                            )}
                            {img.uploader?.username && (
                              <span className={styles.uploaderLabel}>{img.uploader.username}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Comments */}
            <div className={`${styles.card} ${!isGuest && mobileTab !== 'resenas' ? styles.mobileHidden : ''}`}>
              <div className={styles.sectionRow}>
                <span className={styles.eyebrow}>
                  COMENTARIOS
                  {comments.length > 0 && <span className={styles.commentsBadge}>{comments.length}</span>}
                </span>
              </div>
              {commentError && <p className={styles.commentError}>{commentError}</p>}
              {comments.length === 0 ? (
                <p className={styles.commentsEmpty}>Nadie comentó todavía. ¡Sé el primero!</p>
              ) : (
                <div className={styles.commentsList}>
                  {comments.map((comment) => {
                    const isOwn = user && (comment.author._id || comment.author).toString() === user._id.toString()
                    const canDelete = isOwn || isHost || user?.isAdmin
                    return (
                      <div key={comment._id} className={styles.commentItem}>
                        <span className={styles.commentAvatar}>{comment.author.username[0].toUpperCase()}</span>
                        <div className={styles.commentBody}>
                          <div className={styles.commentMeta}>
                            <span className={styles.commentAuthor}>{comment.author.username}</span>
                            <span className={styles.commentTime}>{formatDate(comment.createdAt)}</span>
                            {comment.editedAt && <span className={styles.editedBadge}>editado</span>}
                          </div>
                          {editingCommentId === comment._id ? (
                            <div className={styles.editForm}>
                              <textarea
                                className={styles.editTextarea}
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                maxLength={500}
                                rows={2}
                              />
                              <div className={styles.editActions}>
                                <button className={styles.btnSaveEdit} onClick={() => handleEditComment(comment._id)}>Guardar</button>
                                <button className={styles.btnCancelEdit} onClick={() => setEditingCommentId(null)}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <p className={styles.commentContent}>{comment.content}</p>
                          )}
                        </div>
                        {editingCommentId !== comment._id && (
                          <div className={styles.commentActions}>
                            {isOwn && (
                              <button className={styles.btnCommentEdit} onClick={() => { setEditingCommentId(comment._id); setEditingContent(comment.content) }}>
                                Editar
                              </button>
                            )}
                            {canDelete && (
                              <button className={styles.btnCommentDelete} onClick={() => handleDeleteComment(comment._id)}>
                                Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {isAnon ? (
                <button
                  className={styles.btnComment}
                  onClick={() => setLoginPrompt('Iniciá sesión para comentar en esta mesa.')}
                  type="button"
                >
                  Iniciá sesión para comentar
                </button>
              ) : (
                <form className={styles.addCommentForm} onSubmit={handleAddComment}>
                  <textarea
                    className={styles.commentTextarea}
                    placeholder="Escribí un comentario…"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    maxLength={500}
                    rows={2}
                    disabled={submittingComment}
                  />
                  <button className={styles.btnComment} type="submit" disabled={!commentInput.trim() || submittingComment}>
                    {submittingComment ? '…' : 'Comentar'}
                  </button>
                </form>
              )}
            </div>

            {/* Ratings */}
            {(() => {
              const gameDatePassed = new Date(table.date) < new Date()
              const canRate = gameDatePassed && isParticipant(table)
              return (
                <div className={`${styles.ratingsCard} ${!isGuest && mobileTab !== 'resenas' ? styles.mobileHidden : ''}`}>
                  <div className={styles.sectionRow}>
                    <span className={styles.eyebrow}>¿CÓMO ESTUVO LA SESIÓN?</span>
                    {ratingsCount > 0 && ratingsAvg !== null && (
                      <span className={styles.ratingsAvgBadge}>
                        {'★'.repeat(Math.round(ratingsAvg))}{'☆'.repeat(5 - Math.round(ratingsAvg))} {ratingsAvg.toFixed(1)} ({ratingsCount})
                      </span>
                    )}
                  </div>
                  {canRate && (
                    <form className={styles.ratingForm} onSubmit={handleSubmitRating}>
                      <span className={styles.ratingLabel}>Tu puntuación</span>
                      <div className={styles.starRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`${styles.starBtn} ${star <= (hoverScore || myRatingScore) ? styles.starActive : ''}`}
                            onMouseEnter={() => setHoverScore(star)}
                            onMouseLeave={() => setHoverScore(0)}
                            onClick={() => setMyRatingScore(star)}
                            aria-label={`${star} estrellas`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        className={styles.ratingTextarea}
                        placeholder="Comentario opcional (máx. 300 caracteres)…"
                        value={myRatingComment}
                        onChange={(e) => setMyRatingComment(e.target.value)}
                        maxLength={300}
                        rows={2}
                        disabled={submittingRating}
                      />
                      {ratingError && <p className={styles.ratingError}>{ratingError}</p>}
                      <button className={styles.btnSubmitRating} type="submit" disabled={!myRatingScore || submittingRating}>
                        {submittingRating ? '…' : myRatingScore ? 'Enviar valoración' : 'Seleccioná una puntuación'}
                      </button>
                    </form>
                  )}
                  {ratings.length === 0 ? (
                    <p className={styles.ratingsEmpty}>Todavía no hay valoraciones.</p>
                  ) : (
                    <div className={styles.ratingsList}>
                      {ratings.map((r) => (
                        <div key={r._id} className={styles.ratingItem}>
                          <span className={styles.ratingAvatar}>{r.rater.username[0].toUpperCase()}</span>
                          <div className={styles.ratingBody}>
                            <div className={styles.ratingMeta}>
                              <span className={styles.ratingUsername}>{r.rater.username}</span>
                              <span className={styles.ratingStars}>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
                            </div>
                            {r.comment && <p className={styles.ratingComment}>{r.comment}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Right column: Chat */}
          {!isGuest && (
            <div className={`${styles.chatPanel} ${mobileTab !== 'chat' ? styles.mobileHidden : ''}`}>
              <div className={styles.chatHeader}>
                <span className={styles.eyebrow}>CHAT DE LA MESA</span>
                <span className={styles.chatSubtitle}>
                  {isViewingAsAdmin ? 'Vista de administrador' : 'Solo visible para los participantes'}
                </span>
              </div>

              <div className={styles.messageList} ref={messageListRef}>
                {messages.length === 0 && (
                  <p className={styles.emptyChat}>Nadie habló todavía. ¡Rompé el hielo! 🎲</p>
                )}
                {messages.map((msg) => {
                  const isOwn = (msg.sender._id || msg.sender).toString() === user._id.toString()
                  return (
                    <div key={msg._id} className={`${styles.message} ${isOwn ? styles.ownMessage : styles.otherMessage}`}>
                      {!isOwn && (
                        <span className={styles.msgAvatar}>{msg.sender.username[0].toUpperCase()}</span>
                      )}
                      <div className={styles.msgContent}>
                        {!isOwn && <span className={styles.senderName}>{msg.sender.username}</span>}
                        <div className={styles.bubble}>{msg.content}</div>
                        <span className={styles.messageTime}>{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {error && <p className={styles.chatError}>{error}</p>}

              {!isViewingAsAdmin && (
                <form className={styles.inputRow} onSubmit={sendMessage}>
                  <input
                    className={styles.chatInput}
                    type="text"
                    placeholder="Escribí un mensaje…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={1000}
                    disabled={sending}
                  />
                  <button className={styles.sendCircle} type="submit" disabled={!input.trim() || sending}>
                    <SendIcon />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Vista ampliada" className={styles.lightboxImg} />
        </div>
      )}
    </div>
    </>
  )
}
