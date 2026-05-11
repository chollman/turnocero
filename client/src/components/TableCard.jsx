import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import styles from './TableCard.module.css';


const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const EyeIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const LeaveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function TableCard({ table, onUpdate, onCancel, listMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isHost = table.host._id === user._id || table.host._id?.toString() === user._id?.toString();
  const isPlayer = table.players.some(
    (p) => (p._id || p).toString() === (user._id || user).toString()
  );
  const showAdminTab = user.isAdmin && !isHost && !isPlayer;
  const isPendingRequest = (table.pendingRequests || []).some(
    (r) => (r._id || r).toString() === user._id.toString()
  );
  const isPrivate = table.privacy === 'private';
  const availableSeats = table.maxPlayers - table.players.length;
  const isFull = availableSeats <= 0;

  const handleJoin = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`/api/tables/${table._id}/join`);
      onUpdate(data.table);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al unirse');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`/api/tables/${table._id}/leave`);
      onUpdate(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al salir');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.delete(`/api/tables/${table._id}/request`);
      onUpdate(data.table);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cancelar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('¿Cancelar esta mesa?')) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`/api/tables/${table._id}`);
      onCancel(table._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cancelar');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = isFull ? 'var(--red)' : 'var(--green)';
  const statusLabel = isFull ? 'Completa' : `${availableSeats} lugar${availableSeats !== 1 ? 'es' : ''} libre${availableSeats !== 1 ? 's' : ''}`;

  if (listMode) {
    return (
      <div className={`${styles.card} ${styles.cardList} ${isHost ? styles.hosted : ''} ${isPlayer ? styles.joined : ''}`}>
        <div className={styles.listLeft}>
          <div className={styles.gameTitleWrap}>
            <h3 className={styles.gameName}>{table.boardGame}</h3>
            {isHost && <span className={styles.hostBadge}>Host</span>}
            {isPlayer && <span className={styles.playerBadge}>Unido</span>}
          </div>
          <div className={styles.badges}>
            {isPrivate && <span className={styles.privacyBadge}>🔒 Privada</span>}
            <span className={styles.statusBadge} style={{ color: statusColor, borderColor: statusColor }}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className={styles.listMeta}>
          <span className={styles.listMetaItem}>📅 {formatDate(table.date)}</span>
          <span className={styles.listMetaItem}>👑 <strong>{table.host.username}</strong></span>
          <span className={styles.listMetaItem}>👥 {table.players.length + 1} / {table.maxPlayers + 1}</span>
          {table.location && <span className={styles.listMetaItem}>📍 {table.location}</span>}
        </div>

        <div className={styles.listActions}>
          {error && <span className={styles.errorInline}>{error}</span>}
          {isHost ? (
            <>
              <button className={`${styles.btnIcon} ${styles.btnIconDetail}`} onClick={() => navigate(`/tables/${table._id}`)} title="Ver detalles y chat" disabled={loading}>
                <EyeIcon size={15} />
              </button>
              <button className={`${styles.btnIcon} ${styles.btnIconEdit}`} onClick={() => navigate(`/tables/${table._id}/edit`)} title="Editar mesa" disabled={loading}>
                <EditIcon />
              </button>
              <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={handleCancel} title="Cancelar mesa" disabled={loading}>
                <XIcon />
              </button>
            </>
          ) : isPlayer ? (
            <>
              <button className={`${styles.btnIcon} ${styles.btnIconDetail}`} onClick={() => navigate(`/tables/${table._id}`)} title="Ver detalles y chat" disabled={loading}>
                <EyeIcon size={15} />
              </button>
              <button className={`${styles.btnIcon} ${styles.btnIconLeave}`} onClick={handleLeave} title="Abandonar mesa" disabled={loading}>
                {loading ? '…' : <LeaveIcon />}
              </button>
            </>
          ) : isPendingRequest ? (
            <button className={styles.btnPending} onClick={handleCancelRequest} disabled={loading}>
              {loading ? '…' : 'Solicitud enviada · Cancelar'}
            </button>
          ) : (
            <button className={styles.btnPrimary} onClick={handleJoin} disabled={loading || isFull}>
              {loading ? '…' : isFull ? 'Llena' : isPrivate ? 'Solicitar' : 'Unirse'}
            </button>
          )}
          {showAdminTab && (
            <button
              className={styles.adminTabInline}
              onClick={() => navigate(`/tables/${table._id}`)}
              title="Ver como administrador"
            >
              <EyeIcon /> Admin
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${isHost ? styles.hosted : ''} ${isPlayer ? styles.joined : ''}`} style={{ position: 'relative' }}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.gameTitleWrap}>
          <h3 className={styles.gameName}>{table.boardGame}</h3>
          {isHost && <span className={styles.hostBadge}>Sos el host</span>}
          {isPlayer && <span className={styles.playerBadge}>Te uniste</span>}
        </div>
        <div className={styles.badges}>
          {isPrivate && (
            <span className={styles.privacyBadge}>🔒 Privada</span>
          )}
          <span className={styles.statusBadge} style={{ color: statusColor, borderColor: statusColor }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className={styles.details}>
        <div className={styles.detail}>
          <span className={styles.icon}>📅</span>
          <span>{formatDate(table.date)}</span>
        </div>

        <div className={styles.detail}>
          <span className={styles.icon}>👑</span>
          <span>Host: <strong>{table.host.username}</strong></span>
        </div>

        <div className={styles.detail}>
          <span className={styles.icon}>👥</span>
          <span>
            {table.players.length + 1} / {table.maxPlayers + 1} jugadores
          </span>
        </div>

        {table.location && (
          <div className={styles.detail}>
            <span className={styles.icon}>📍</span>
            <span>{table.location}</span>
          </div>
        )}
      </div>

      {/* Players list */}
      {table.players.length > 0 && (
        <div className={styles.players}>
          <span className={styles.playersLabel}>Jugadores:</span>
          <div className={styles.playersList}>
            {table.players.map((p) => (
              <span key={p._id || p} className={styles.playerChip}>
                {p.username || p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {table.description && (
        <p className={styles.description}>{table.description}</p>
      )}

      {/* Reactions — read-only summary, only shown if the table has reactions */}
      {(table.reactions || []).length > 0 && (() => {
        const groups = (table.reactions || []).reduce((acc, r) => {
          acc[r.emoji] = (acc[r.emoji] || 0) + 1
          return acc
        }, {})
        return (
          <div className={styles.reactionsRow}>
            {Object.entries(groups).map(([emoji, count]) => (
              <span key={emoji} className={styles.reactionChip}>
                {emoji} <span className={styles.reactionCountSm}>{count}</span>
              </span>
            ))}
          </div>
        )
      })()}

      {/* Error */}
      {error && <p className={styles.error}>{error}</p>}

      {/* Actions */}
      <div className={styles.actions}>
        {isHost ? (
          <>
            <button
              className={`${styles.btnIcon} ${styles.btnIconDetail}`}
              onClick={() => navigate(`/tables/${table._id}`)}
              title="Ver detalles y chat"
              disabled={loading}
            >
              <EyeIcon size={15} />
            </button>
            <button
              className={`${styles.btnIcon} ${styles.btnIconEdit}`}
              onClick={() => navigate(`/tables/${table._id}/edit`)}
              title="Editar mesa"
              disabled={loading}
            >
              <EditIcon />
            </button>
            <button
              className={`${styles.btnIcon} ${styles.btnIconDanger}`}
              onClick={handleCancel}
              title="Cancelar mesa"
              disabled={loading}
            >
              <XIcon />
            </button>
          </>
        ) : isPlayer ? (
          <>
            <button
              className={`${styles.btnIcon} ${styles.btnIconDetail}`}
              onClick={() => navigate(`/tables/${table._id}`)}
              title="Ver detalles y chat"
              disabled={loading}
            >
              <EyeIcon size={15} />
            </button>
            <button
              className={`${styles.btnIcon} ${styles.btnIconLeave}`}
              onClick={handleLeave}
              title="Abandonar mesa"
              disabled={loading}
            >
              {loading ? '…' : <LeaveIcon />}
            </button>
          </>
        ) : isPendingRequest ? (
          <button
            className={styles.btnPending}
            onClick={handleCancelRequest}
            disabled={loading}
          >
            {loading ? '…' : 'Solicitud enviada · Cancelar'}
          </button>
        ) : (
          <button
            className={styles.btnPrimary}
            onClick={handleJoin}
            disabled={loading || isFull}
          >
            {loading ? '…' : isFull ? 'Mesa llena' : isPrivate ? 'Solicitar unirse' : 'Unirse'}
          </button>
        )}

      </div>

      {showAdminTab && (
        <button
          className={styles.adminTab}
          onClick={() => navigate(`/tables/${table._id}`)}
          title="Ver como administrador"
        >
          <EyeIcon /> Admin
        </button>
      )}
    </div>
  );
}
