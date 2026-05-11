import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
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

  // Mark this table as active so notifications are suppressed while viewing
  useEffect(() => {
    setActiveTable(id)
    return () => setActiveTable(null)
  }, [id, setActiveTable])

  // Fetch table + validate access
  useEffect(() => {
    const fetchTable = async () => {
      try {
        const { data } = await axios.get(`/api/tables/${id}`)
        // Private tables: only members and admins can view
        if (data.privacy === 'private' && !isParticipant(data) && !user.isAdmin) {
          navigate('/', { replace: true })
          return
        }
        setTable(data)
        setPendingRequests(data.pendingRequests || [])
      } catch {
        navigate('/', { replace: true })
      } finally {
        setLoadingTable(false)
      }
    }
    fetchTable()
  }, [id])

  // Fetch message history once table is confirmed
  useEffect(() => {
    if (!table) return
    axios
      .get(`/api/tables/${id}/messages`)
      .then(({ data }) => setMessages(data))
  }, [table])

  // Fetch comments once table is confirmed
  useEffect(() => {
    if (!table) return
    axios
      .get(`/api/tables/${id}/comments`)
      .then(({ data }) => setComments(data))
      .catch(() => {})
  }, [table])

  // Socket.io connection
  useEffect(() => {
    if (!table) return
    const token = localStorage.getItem('token')
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.emit('join:table', id)

    socket.on('chat:message', (msg) => {
      setMessages((prev) => [...prev, msg])
    })

    return () => {
      socket.emit('leave:table', id)
      socket.disconnect()
    }
  }, [table, id])

  // Auto-scroll chat on new messages and on initial load
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

  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')

  const handleGuestJoin = async () => {
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

  const handleReact = async (emoji) => {
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

  if (!table) return null

  const isHost = table.host._id?.toString() === user._id.toString()
  const isViewingAsAdmin = user.isAdmin && !isParticipant(table)
  const isGuest = !isParticipant(table) && !user.isAdmin
  const isFull = table.players.length >= table.maxPlayers
  const statusLabel = isFull
    ? 'Completa'
    : `${table.maxPlayers - table.players.length} lugar${table.maxPlayers - table.players.length !== 1 ? 'es' : ''} libre${table.maxPlayers - table.players.length !== 1 ? 's' : ''}`

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Back button */}
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Volver al dashboard
        </button>

        <div className={`${styles.layout} ${isGuest ? styles.layoutSingle : ''}`}>
          {/* Left: Table details */}
          <div className={styles.detailsPanel}>
            <div className={styles.detailsHeader}>
              <h1 className={styles.gameTitle}>{table.boardGame}</h1>
              <span
                className={styles.statusBadge}
                style={{
                  color: isFull ? 'var(--red)' : 'var(--green)',
                  borderColor: isFull ? 'var(--red)' : 'var(--green)',
                }}
              >
                {statusLabel}
              </span>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>📅</span>
                <div>
                  <span className={styles.infoLabel}>Fecha y hora</span>
                  <span className={styles.infoValue}>
                    {formatDate(table.date)}
                  </span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>👑</span>
                <div>
                  <span className={styles.infoLabel}>Host</span>
                  <span className={styles.infoValue}>
                    {table.host.username}
                    {isHost && <span className={styles.youTag}> (vos)</span>}
                  </span>
                </div>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>👥</span>
                <div>
                  <span className={styles.infoLabel}>Jugadores</span>
                  <span className={styles.infoValue}>
                    {table.players.length + 1} / {table.maxPlayers + 1}
                  </span>
                </div>
              </div>

              {table.location && (
                <div className={styles.infoItem}>
                  <span className={styles.infoIcon}>📍</span>
                  <div>
                    <span className={styles.infoLabel}>Lugar</span>
                    <span className={styles.infoValue}>{table.location}</span>
                  </div>
                </div>
              )}
            </div>

            {table.description && (
              <div className={styles.descriptionBlock}>
                <span className={styles.infoLabel}>Descripción</span>
                <p className={styles.descriptionText}>{table.description}</p>
              </div>
            )}

            {/* Reactions */}
            {(() => {
              const reactions = table.reactions || []
              const myReaction = reactions.find((r) => r.user?.toString() === user._id.toString())?.emoji || null
              return (
                <div className={styles.reactionSection}>
                  <span className={styles.infoLabel}>¿Qué te parece esta mesa?</span>
                  <div className={styles.reactionBar}>
                    {REACTION_EMOJIS.map((emoji) => {
                      const count = reactions.filter((r) => r.emoji === emoji).length
                      return (
                        <button
                          key={emoji}
                          className={`${styles.reactionBtn} ${myReaction === emoji ? styles.reactionActive : ''}`}
                          onClick={() => handleReact(emoji)}
                          title={myReaction === emoji ? 'Quitar reacción' : 'Reaccionar'}
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

            {/* Participants */}
            <div className={styles.participantsBlock}>
              <span className={styles.infoLabel}>Participantes</span>
              <div className={styles.participantsList}>
                <div className={styles.participant}>
                  <span className={styles.avatar}>
                    {table.host.username[0].toUpperCase()}
                  </span>
                  <span className={styles.participantName}>
                    {table.host.username}
                  </span>
                  <span className={styles.hostTag}>Host</span>
                </div>
                {table.players.map((p) => (
                  <div key={p._id || p} className={styles.participant}>
                    <span className={styles.avatar}>
                      {(p.username || '?')[0].toUpperCase()}
                    </span>
                    <span className={styles.participantName}>{p.username}</span>
                    {(p._id || p).toString() === user._id.toString() && (
                      <span className={styles.youTag}>vos</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Guest join action */}
            {isGuest && table.status !== 'cancelled' && (
              <div className={styles.guestJoinBlock}>
                {joinError && <p className={styles.guestJoinError}>{joinError}</p>}
                <button
                  className={styles.btnGuestJoin}
                  onClick={handleGuestJoin}
                  disabled={joinLoading || isFull}
                >
                  {joinLoading ? '…' : isFull ? 'Mesa completa' : '¡Unirme a la mesa!'}
                </button>
                <p className={styles.chatPrivateNote}>
                  El chat es privado y solo está disponible para los miembros.
                </p>
              </div>
            )}

            {/* Pending requests – host only, private tables */}
            {isHost && table.privacy === 'private' && (
              <div className={styles.requestsSection}>
                <h2 className={styles.requestsTitle}>
                  Solicitudes pendientes
                  {pendingRequests.length > 0 && (
                    <span className={styles.requestsBadge}>{pendingRequests.length}</span>
                  )}
                </h2>
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
                          <button
                            className={styles.btnAccept}
                            onClick={() => handleRequest(req._id, 'accept')}
                            disabled={requestLoading !== null}
                          >
                            {requestLoading === req._id + 'accept' ? '…' : 'Aceptar'}
                          </button>
                          <button
                            className={styles.btnReject}
                            onClick={() => handleRequest(req._id, 'reject')}
                            disabled={requestLoading !== null}
                          >
                            {requestLoading === req._id + 'reject' ? '…' : 'Rechazar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right: Chat — private, only for members and admins */}
          {!isGuest && <div className={styles.chatPanel}>
            <div className={styles.chatHeader}>
              <h2 className={styles.chatTitle}>Chat de la mesa</h2>
              <span className={styles.chatSubtitle}>
                {isViewingAsAdmin ? 'Vista de administrador' : 'Solo visible para los participantes'}
              </span>
            </div>

            {isViewingAsAdmin && (
              <div className={styles.adminBanner}>
                👁 Estás viendo esta mesa como administrador
              </div>
            )}

            <div className={styles.messageList} ref={messageListRef}>
              {messages.length === 0 && (
                <p className={styles.emptyChat}>
                  Nadie habló todavía. ¡Rompé el hielo! 🎲
                </p>
              )}
              {messages.map((msg) => {
                const isOwn =
                  (msg.sender._id || msg.sender).toString() ===
                  user._id.toString()
                return (
                  <div
                    key={msg._id}
                    className={`${styles.message} ${isOwn ? styles.ownMessage : styles.otherMessage}`}
                  >
                    {!isOwn && (
                      <span className={styles.senderName}>
                        {msg.sender.username}
                      </span>
                    )}
                    <div className={styles.bubble}>{msg.content}</div>
                    <span className={styles.messageTime}>
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>

            {error && <p className={styles.chatError}>{error}</p>}

            {!isViewingAsAdmin && (
              <form className={styles.inputRow} onSubmit={sendMessage}>
                <input
                  className={styles.chatInput}
                  type='text'
                  placeholder='Escribí un mensaje…'
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1000}
                  disabled={sending}
                />
                <button
                  className={styles.sendBtn}
                  type='submit'
                  disabled={!input.trim() || sending}
                >
                  Enviar
                </button>
              </form>
            )}
          </div>}
        </div>

        {/* Image gallery */}
        {(() => {
          const images = table.images || []
          const canUpload = isParticipant(table) && !isViewingAsAdmin && images.length < 10
          return (
            <div className={styles.gallerySection}>
              <div className={styles.galleryHeader}>
                <h2 className={styles.galleryTitle}>
                  Fotos de la mesa
                  {images.length > 0 && (
                    <span className={styles.galleryBadge}>{images.length}/10</span>
                  )}
                </h2>
                {canUpload && (
                  <>
                    <button
                      className={styles.btnUpload}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? 'Subiendo…' : '+ Agregar foto'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='image/jpeg,image/png,image/webp,image/gif'
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
                    const isUploader = (img.uploader?._id || img.uploader)?.toString() === user._id.toString()
                    const canDelete = isUploader || isHost || user.isAdmin
                    return (
                      <div key={img._id} className={styles.imageThumb}>
                        <img
                          src={img.url}
                          alt='Foto de la mesa'
                          className={styles.thumbImg}
                          onClick={() => setLightboxImage(img.url)}
                        />
                        {canDelete && (
                          <button
                            className={styles.btnDeleteImg}
                            onClick={() => handleImageDelete(img._id)}
                            title='Eliminar imagen'
                          >
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

        {/* Lightbox */}
        {lightboxImage && (
          <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage} alt='Vista ampliada' className={styles.lightboxImg} />
          </div>
        )}

        {/* Comments */}
        <div className={styles.commentsSection}>
          <h2 className={styles.commentsTitle}>
            Comentarios
            {comments.length > 0 && (
              <span className={styles.commentsBadge}>{comments.length}</span>
            )}
          </h2>

          {commentError && <p className={styles.commentError}>{commentError}</p>}

          {comments.length === 0 ? (
            <p className={styles.commentsEmpty}>Nadie comentó todavía. ¡Sé el primero!</p>
          ) : (
            <div className={styles.commentsList}>
              {comments.map((comment) => {
                const isOwn = (comment.author._id || comment.author).toString() === user._id.toString()
                const canDelete = isOwn || isHost || user.isAdmin
                return (
                  <div key={comment._id} className={styles.commentItem}>
                    <span className={styles.commentAvatar}>
                      {comment.author.username[0].toUpperCase()}
                    </span>
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
                            <button className={styles.btnSaveEdit} onClick={() => handleEditComment(comment._id)}>
                              Guardar
                            </button>
                            <button className={styles.btnCancelEdit} onClick={() => setEditingCommentId(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={styles.commentContent}>{comment.content}</p>
                      )}
                    </div>
                    {editingCommentId !== comment._id && (
                      <div className={styles.commentActions}>
                        {isOwn && (
                          <button
                            className={styles.btnCommentEdit}
                            onClick={() => { setEditingCommentId(comment._id); setEditingContent(comment.content) }}
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={styles.btnCommentDelete}
                            onClick={() => handleDeleteComment(comment._id)}
                          >
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

          <form className={styles.addCommentForm} onSubmit={handleAddComment}>
            <textarea
              className={styles.commentTextarea}
              placeholder='Escribí un comentario…'
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={submittingComment}
            />
            <button
              className={styles.btnComment}
              type='submit'
              disabled={!commentInput.trim() || submittingComment}
            >
              {submittingComment ? '…' : 'Comentar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
