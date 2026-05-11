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

export default function TableCard({ table, onUpdate, onCancel }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isHost = table.host._id === user._id || table.host._id?.toString() === user._id?.toString();
  const isPlayer = table.players.some(
    (p) => (p._id || p).toString() === (user._id || user).toString()
  );
  const availableSeats = table.maxPlayers - table.players.length;
  const isFull = availableSeats <= 0;

  const handleAction = async (action) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`/api/tables/${table._id}/${action}`);
      onUpdate(data);
    } catch (err) {
      setError(err.response?.data?.message || (action === 'join' ? 'Error al unirse' : 'Error al salir'));
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

  return (
    <div className={`${styles.card} ${isHost ? styles.hosted : ''} ${isPlayer ? styles.joined : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.gameName}>{table.boardGame}</h3>
        <span className={styles.statusBadge} style={{ color: statusColor, borderColor: statusColor }}>
          {statusLabel}
        </span>
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
              onClick={() => handleAction('leave')}
              disabled={loading}
            >
              {loading ? '…' : 'Abandonar'}
            </button>
          </>
        ) : (
          <button
            className={styles.btnPrimary}
            onClick={() => handleAction('join')}
            disabled={loading || isFull}
          >
            {loading ? '…' : isFull ? 'Mesa llena' : 'Unirse'}
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
