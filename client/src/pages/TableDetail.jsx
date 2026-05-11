import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import styles from './TableDetail.module.css'

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
        if (!isParticipant(data)) {
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

        <div className={styles.layout}>
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

          {/* Right: Chat */}
          <div className={styles.chatPanel}>
            <div className={styles.chatHeader}>
              <h2 className={styles.chatTitle}>Chat de la mesa</h2>
              <span className={styles.chatSubtitle}>
                Solo visible para los participantes
              </span>
            </div>

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
          </div>
        </div>
      </div>
    </div>
  )
}
