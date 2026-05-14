import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import GameTile from '../../components/shared/GameTile';
import LoginPromptModal from '../../components/shared/LoginPromptModal';
import styles from './TableCard.module.css';

// --- helpers ---

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function getDateParts(dateStr) {
  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace(/\./g, '');
  const day = date.getDate();
  const month = date.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace(/\./g, '');
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { weekday, day, month, time };
}

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

// --- icons ---

const PinIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const LockIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const EyeIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const LeaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// --- sub-components ---

function SeatTrack({ filled, total }) {
  const pct = Math.min(100, (filled / total) * 100);
  return (
    <div className={styles.seatTrack}>
      <div className={styles.seatFill} style={{ width: `${pct}%` }} />
      {Array.from({ length: total - 1 }).map((_, i) => (
        <span
          key={i}
          className={styles.seatDivider}
          style={{ left: `${((i + 1) / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function StatusChip({ seats }) {
  const full = seats <= 0;
  return (
    <span className={`${styles.statusChip} ${full ? styles.statusFull : styles.statusOpen}`}>
      <span className={styles.statusDot} />
      {full ? 'Mesa completa' : `${seats} lugar${seats !== 1 ? 'es' : ''}`}
    </span>
  );
}

// --- main component ---

export default function TableCard({ table, onUpdate, onCancel, listMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginPrompt, setLoginPrompt] = useState('');
  const [flashing, setFlashing] = useState(false);

  const isHost = user && (table.host._id === user._id || table.host._id?.toString() === user._id?.toString());
  const isPlayer = user && table.players.some(
    (p) => (p._id || p).toString() === (user._id || user).toString()
  );
  const showAdminTab = user?.isAdmin && !isHost && !isPlayer;
  const isPendingRequest = user && (table.pendingRequests || []).some(
    (r) => (r._id || r).toString() === user._id.toString()
  );
  const isPrivate = table.privacy === 'private';
  const availableSeats = table.maxPlayers - table.players.length;
  const isFull = availableSeats <= 0;

  const requireAuth = (msg) => {
    if (!user) { setLoginPrompt(msg); return false; }
    return true;
  };

  const handleJoin = async () => {
    if (!requireAuth('Iniciá sesión para unirte a esta mesa.')) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`/api/tables/${table._id}/join`);
      onUpdate(data.table);
      setFlashing(true);
      setTimeout(() => setFlashing(false), 500);
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

  // ─── LIST MODE ────────────────────────────────────────────────

  if (listMode) {
    const statusColor = isFull ? 'var(--red)' : 'var(--green)';
    const statusLabel = isFull
      ? 'Completa'
      : `${availableSeats} lugar${availableSeats !== 1 ? 'es' : ''} libre${availableSeats !== 1 ? 's' : ''}`;

    return (
      <>
      <LoginPromptModal isOpen={!!loginPrompt} onClose={() => setLoginPrompt('')} message={loginPrompt} />
      <div className={`${styles.cardList} ${isHost ? styles.hosted : ''} ${isPlayer ? styles.joined : ''}`}>
        <div className={styles.listLeft}>
          <div className={styles.listTitleWrap}>
            <h3 className={styles.listGameName}>{table.boardGame}</h3>
            {isHost && <span className={styles.hostBadge}>HOST</span>}
            {isPlayer && <span className={styles.playerBadge}>UNIDO</span>}
          </div>
          <div className={styles.listBadges}>
            {isPrivate && <span className={styles.lockBadge}><LockIcon size={10} /> Privada</span>}
            <span className={styles.listStatus} style={{ color: statusColor, borderColor: statusColor }}>
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
              <button className={`${styles.btnIcon} ${styles.btnIconDetail}`} onClick={() => navigate(`/mesas/${table._id}`)} title="Ver detalles" disabled={loading}><EyeIcon /></button>
              <button className={`${styles.btnIcon} ${styles.btnIconEdit}`} onClick={() => navigate(`/mesas/${table._id}/editar`)} title="Editar" disabled={loading}><EditIcon /></button>
              <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={handleCancel} title="Cancelar" disabled={loading}><XIcon /></button>
            </>
          ) : isPlayer ? (
            <>
              <button className={`${styles.btnIcon} ${styles.btnIconDetail}`} onClick={() => navigate(`/mesas/${table._id}`)} title="Ver detalles" disabled={loading}><EyeIcon /></button>
              <button className={`${styles.btnIcon} ${styles.btnIconLeave}`} onClick={handleLeave} title="Abandonar" disabled={loading}>{loading ? '…' : <LeaveIcon />}</button>
            </>
          ) : isPendingRequest ? (
            <button className={styles.btnPending} onClick={handleCancelRequest} disabled={loading}>{loading ? '…' : 'Solicitud enviada · Cancelar'}</button>
          ) : (
            <>
              {!isPrivate && (
                <button className={`${styles.btnIcon} ${styles.btnIconDetail}`} onClick={() => navigate(`/mesas/${table._id}`)} title="Ver detalle" disabled={loading}><EyeIcon /></button>
              )}
              <button className={styles.btnJoin} onClick={handleJoin} disabled={loading || isFull}>
                {loading ? '…' : isFull ? 'Llena' : isPrivate ? 'Solicitar' : 'Unirse'}
              </button>
            </>
          )}
          {showAdminTab && (
            <button className={styles.adminTabInline} onClick={() => navigate(`/mesas/${table._id}`)} title="Ver como admin">
              <EyeIcon /> Admin
            </button>
          )}
        </div>
      </div>
      </>
    );
  }

  // ─── GRID MODE (Token & Track) ────────────────────────────────

  const { weekday, day, month, time } = getDateParts(table.date);
  const seed = hashStr(table._id || '') % 10;

  return (
    <>
    <LoginPromptModal isOpen={!!loginPrompt} onClose={() => setLoginPrompt('')} message={loginPrompt} />
    <div
      className={`${styles.card} ${isHost ? styles.hosted : ''} ${isPlayer ? styles.joined : ''} ${table.bggImage ? styles.hasImage : ''} ${flashing ? styles.joinFlash : ''}`}
      style={{ position: 'relative' }}
    >
      {table.bggImage && (
        <div className={styles.cardBg}>
          <GameTile game={table.boardGame} seed={seed} size="100%" imageUrl={table.bggImage} />
        </div>
      )}

      {/* Banner with game tile */}
      <div className={styles.banner}>
        {!table.bggImage && (
          <GameTile game={table.boardGame} seed={seed} size="100%" />
        )}
        <div className={styles.bannerGradient} />
        <div className={styles.bannerTop}>
          <span className={styles.dateChip}>
            <span className={styles.dateChipDot}>●</span>
            {weekday} · {day} {month} · {time}
          </span>
          <div className={styles.bannerBadges}>
            {isHost && <span className={styles.hostBadge}>HOST</span>}
            {isPlayer && <span className={styles.playerBadge}>UNIDO</span>}
            {isPrivate && (
              <span className={styles.lockBadge}><LockIcon size={11} /></span>
            )}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className={styles.body}>
        <h3 className={styles.gameName}>{table.boardGame}</h3>

        {table.location && (
          <div className={styles.location}>
            <PinIcon size={13} />
            <span>{table.location}</span>
          </div>
        )}

        {/* Seat track */}
        <div className={styles.seatSection}>
          <div className={styles.seatHeader}>
            <span className={styles.seatLabel}>LUGARES</span>
            <span className={styles.seatCount}>{table.players.length + 1}/{table.maxPlayers + 1}</span>
          </div>
          <SeatTrack filled={table.players.length + 1} total={table.maxPlayers + 1} />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {/* Footer: host info + CTA */}
        <div className={styles.footer}>
          <div className={styles.hostInfo}>
            <div className={styles.hostAvatar}>
              {table.host.username[0].toUpperCase()}
            </div>
            <div className={styles.hostDetails}>
              <span className={styles.hostName}>{table.host.username}</span>
              <StatusChip seats={availableSeats} />
            </div>
          </div>

          <div className={styles.footerActions}>
            {isHost ? (
              <>
                <button
                  className={`${styles.btnIcon} ${styles.btnIconEdit}`}
                  onClick={() => navigate(`/mesas/${table._id}/editar`)}
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
                <button
                  className={styles.btnManage}
                  onClick={() => navigate(`/mesas/${table._id}`)}
                  disabled={loading}
                >
                  Administrar
                </button>
              </>
            ) : isPlayer ? (
              <>
                <button
                  className={`${styles.btnIcon} ${styles.btnIconLeave}`}
                  onClick={handleLeave}
                  title="Abandonar mesa"
                  disabled={loading}
                >
                  {loading ? '…' : <LeaveIcon />}
                </button>
                <button
                  className={styles.btnOpen}
                  onClick={() => navigate(`/mesas/${table._id}`)}
                  disabled={loading}
                >
                  Abrir mesa
                </button>
              </>
            ) : isPendingRequest ? (
              <button
                className={styles.btnPending}
                onClick={handleCancelRequest}
                disabled={loading}
              >
                {loading ? '…' : 'Cancelar solicitud'}
              </button>
            ) : isFull ? (
              <button className={styles.btnFull} disabled>Llena</button>
            ) : (
              <>
                {!isPrivate && (
                  <button
                    className={`${styles.btnIcon} ${styles.btnIconDetail}`}
                    onClick={() => navigate(`/mesas/${table._id}`)}
                    title="Ver detalles"
                    disabled={loading}
                  >
                    <EyeIcon />
                  </button>
                )}
                <button
                  className={styles.btnJoin}
                  onClick={handleJoin}
                  disabled={loading}
                >
                  {loading ? '…' : isPrivate ? 'Solicitar' : 'Unirme'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showAdminTab && (
        <button
          className={styles.adminTab}
          onClick={() => navigate(`/mesas/${table._id}`)}
          title="Ver como administrador"
        >
          <EyeIcon /> Admin
        </button>
      )}
    </div>
    </>
  );
}
