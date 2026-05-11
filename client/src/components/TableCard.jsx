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

export default function TableCard({ table, onUpdate, onCancel, listMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isHost = table.host._id === user._id || table.host._id?.toString() === user._id?.toString();
  const isPlayer = table.players.some(
    (p) => (p._id || p).toString() === (user._id || user).toString()
  );
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
          <h3 className={styles.gameName}>{table.boardGame}</h3>
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
              <button className={styles.btnDetail} onClick={() => navigate(`/tables/${table._id}`)} disabled={loading}>
                Ver detalles
              </button>
              <button className={styles.btnDanger} onClick={handleCancel} disabled={loading}>
                Cancelar
              </button>
            </>
          ) : isPlayer ? (
            <>
              <button className={styles.btnDetail} onClick={() => navigate(`/tables/${table._id}`)} disabled={loading}>
                Ver detalles
              </button>
              <button className={styles.btnSecondary} onClick={handleLeave} disabled={loading}>
                {loading ? '…' : 'Abandonar'}
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
          {isHost && <span className={styles.hostBadge}>Host</span>}
          {isPlayer && <span className={styles.playerBadge}>Unido</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${isHost ? styles.hosted : ''} ${isPlayer ? styles.joined : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.gameName}>{table.boardGame}</h3>
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

      {/* Error */}
      {error && <p className={styles.error}>{error}</p>}

      {/* Actions */}
      <div className={styles.actions}>
        {isHost ? (
          <>
            <button
              className={styles.btnDetail}
              onClick={() => navigate(`/tables/${table._id}`)}
              disabled={loading}
            >
              Ver detalles y chat
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => navigate(`/tables/${table._id}/edit`)}
              disabled={loading}
            >
              Editar
            </button>
            <button
              className={styles.btnDanger}
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar mesa
            </button>
          </>
        ) : isPlayer ? (
          <>
            <button
              className={styles.btnDetail}
              onClick={() => navigate(`/tables/${table._id}`)}
              disabled={loading}
            >
              Ver detalles y chat
            </button>
            <button
              className={styles.btnSecondary}
              onClick={handleLeave}
              disabled={loading}
            >
              {loading ? '…' : 'Abandonar'}
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

        {isHost && (
          <span className={styles.hostBadge}>Sos el host</span>
        )}
        {isPlayer && (
          <span className={styles.playerBadge}>Te uniste</span>
        )}
      </div>
    </div>
  );
}
