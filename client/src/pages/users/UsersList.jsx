import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import ConfirmActionModal from '../../components/shared/ConfirmActionModal'
import styles from './UsersList.module.css'
import UsersListSkeleton from './UsersListSkeleton'

const SORT_OPTIONS = [
  { value: 'alpha', label: 'A–Z' },
  { value: 'activity', label: 'Más activos' },
  { value: 'date_desc', label: 'Más nuevos' },
  { value: 'date_asc', label: 'Más antiguos' },
]

function UserCard({ user, currentUser, isAdmin, onBan, onDelete }) {
  const navigate = useNavigate()
  const displayLabel =
    user.displayName ||
    [user.nombre, user.apellido].filter(Boolean).join(' ') ||
    user.username
  const totalActivity = user.tablesHosted + user.tablesAsPlayer
  const joined = new Date(user.createdAt).toLocaleDateString('es-AR', {
    month: 'short',
    year: 'numeric',
  })

  const isSelf = currentUser?._id === user._id
  const showAdminActions = isAdmin && !isSelf && !user.isAdmin

  return (
    <div
      className={`${styles.card} ${user.isBanned ? styles.cardBanned : ''}`}
      onClick={() => navigate(`/usuarios/${user._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/usuarios/${user._id}`)
        }
      }}
    >
      {user.isBanned && (
        <span
          className={styles.bannedBadge}
          title={user.bannedReason ? `Motivo: ${user.bannedReason}` : 'Usuario baneado'}
        >
          Baneado
        </span>
      )}
      {user.isAdmin && !isSelf && (
        <span className={styles.adminBadge}>Admin</span>
      )}

      <div className={styles.cardAvatar}>
        {user.username.charAt(0).toUpperCase()}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardUsername}>@{user.username}</p>
        {displayLabel !== user.username && (
          <p className={styles.cardName}>{displayLabel}</p>
        )}
        <div className={styles.cardMeta}>
          {user.direccion?.texto && (
            <span className={styles.metaChip}>
              <span className={styles.metaIcon}>📍</span>
              {user.direccion.texto.length > 30
                ? `${user.direccion.texto.slice(0, 30)}…`
                : user.direccion.texto}
            </span>
          )}
          <span className={styles.metaChip}>
            <span className={styles.metaIcon}>📅</span>
            Desde {joined}
          </span>
        </div>
      </div>
      <div className={styles.cardStats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.tablesHosted}</span>
          <span className={styles.statLabel}>Mesas creadas</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.tablesAsPlayer}</span>
          <span className={styles.statLabel}>Mesas jugadas</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>{user.compartidas}</span>
          <span className={styles.statLabel}>Publicaciones</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span
            className={`${styles.statValue} ${totalActivity > 0 ? styles.statValueActive : ''}`}
          >
            {totalActivity}
          </span>
          <span className={styles.statLabel}>Total</span>
        </div>
      </div>

      {showAdminActions && (
        <div className={styles.adminActions} onClick={(e) => e.stopPropagation()}>
          <button
            className={user.isBanned ? styles.unbanButton : styles.banButton}
            onClick={(e) => {
              e.stopPropagation()
              onBan(user)
            }}
          >
            {user.isBanned ? 'Desbanear' : 'Banear'}
          </button>
          <button
            className={styles.deleteButton}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(user)
            }}
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

export default function UsersList() {
  const { user: currentUser } = useAuth()
  const isAdmin = !!currentUser?.isAdmin
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('alpha')
  const [activeOnly, setActiveOnly] = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  const [banTarget, setBanTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { sortBy }
      if (search) params.search = search
      if (activeOnly) params.activeOnly = 'true'
      if (friendsOnly) params.friendsOnly = 'true'
      const { data } = await axios.get('/api/users', { params })
      setUsers(data)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [search, sortBy, activeOnly, friendsOnly])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const handleBanConfirm = async (reason) => {
    if (!banTarget) return
    setActionLoading(true)
    setActionError('')
    try {
      const { data } = await axios.patch(`/api/admin/users/${banTarget._id}/ban`, {
        banned: !banTarget.isBanned,
        reason: banTarget.isBanned ? '' : reason || '',
      })
      setUsers((prev) =>
        prev.map((u) =>
          u._id === banTarget._id
            ? { ...u, isBanned: data.isBanned, bannedAt: data.bannedAt, bannedReason: data.bannedReason }
            : u
        )
      )
      setBanTarget(null)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Error al actualizar')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    setActionError('')
    try {
      await axios.delete(`/api/admin/users/${deleteTarget._id}`)
      setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id))
      setDeleteTarget(null)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Error al eliminar')
    } finally {
      setActionLoading(false)
    }
  }

  const closeModals = () => {
    if (actionLoading) return
    setBanTarget(null)
    setDeleteTarget(null)
    setActionError('')
  }

  const visibleUsers = isAdmin ? users : users.filter((u) => !u.isBanned)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heroBlock}>
          <div className={styles.eyebrow}>◆ COMUNIDAD</div>
          <h1 className={styles.heroTitle}>Comunidad</h1>
          <p className={styles.heroSub}>Jugadores registrados en Turnocero</p>
        </div>
        <span className={styles.countBadge}>
          {visibleUsers.length} jugador{visibleUsers.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {currentUser && !currentUser.bggUsername && (
        <Link to="/bg-watch" className={styles.bgWatchBanner}>
          <span className={styles.bgWatchBannerIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2.5" />
              <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div className={styles.bgWatchBannerBody}>
            <strong className={styles.bgWatchBannerTitle}>
              ¿Ya conocés BG Watch?
            </strong>
            <p className={styles.bgWatchBannerSub}>
              Conectá tu cuenta de BoardGameGeek y llevá registro de tus partidas desde Turnocero.
            </p>
          </div>
          <span className={styles.bgWatchBannerCta}>Activá →</span>
        </Link>
      )}

      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type='text'
            placeholder='Buscar por usuario o nombre…'
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              className={styles.clearBtn}
              onClick={() => {
                setSearchInput('')
                setSearch('')
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div className={styles.filters}>
          <select
            className={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            className={`${styles.toggleBtn} ${activeOnly ? styles.toggleActive : ''}`}
            onClick={() => setActiveOnly((v) => !v)}
          >
            Solo activos
          </button>

          {currentUser && (
            <button
              className={`${styles.toggleBtn} ${friendsOnly ? styles.toggleActive : ''}`}
              onClick={() => setFriendsOnly((v) => !v)}
            >
              Solo amigos
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <UsersListSkeleton key={i} />
          ))}
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>👥</span>
          <p>No se encontraron jugadores</p>
          {(search || activeOnly) && (
            <button
              className={styles.clearFiltersBtn}
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setActiveOnly(false)
                setFriendsOnly(false)
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {visibleUsers.map((u) => (
            <UserCard
              key={u._id}
              user={u}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onBan={setBanTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ConfirmActionModal
        isOpen={!!banTarget}
        title={banTarget?.isBanned ? 'Desbanear usuario' : 'Banear usuario'}
        message={
          banTarget?.isBanned
            ? `¿Querés desbanear a @${banTarget?.username}? Podrá volver a iniciar sesión y usar la app.`
            : `¿Querés banear a @${banTarget?.username}? No podrá iniciar sesión y será expulsado si ya tiene una sesión activa.${actionError ? `\n\n${actionError}` : ''}`
        }
        confirmLabel={banTarget?.isBanned ? 'Desbanear' : 'Banear'}
        variant={banTarget?.isBanned ? 'warning' : 'danger'}
        inputLabel={banTarget && !banTarget.isBanned ? 'Motivo del baneo (opcional)' : undefined}
        inputPlaceholder="Por ejemplo: spam reiterado, comportamiento inapropiado…"
        loading={actionLoading}
        onConfirm={handleBanConfirm}
        onCancel={closeModals}
      />

      <ConfirmActionModal
        isOpen={!!deleteTarget}
        title="Eliminar usuario"
        message={`¿Querés eliminar a @${deleteTarget?.username}? Esta acción no se puede deshacer. El usuario podrá registrarse nuevamente con el mismo email y sus contenidos (mesas, mensajes, comentarios) figurarán como "Usuario eliminado".${actionError ? `\n\n${actionError}` : ''}`}
        confirmLabel="Eliminar definitivamente"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={closeModals}
      />
    </div>
  )
}
