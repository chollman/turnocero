import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './BggProfile.module.css';

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function relativeDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (days < 0) return 'En el futuro';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `Hace ${w} ${w === 1 ? 'semana' : 'semanas'}`;
  }
  if (days < 365) {
    const mo = Math.floor(days / 30);
    return `Hace ${mo} ${mo === 1 ? 'mes' : 'meses'}`;
  }
  const yr = Math.floor(days / 365);
  return `Hace ${yr} ${yr === 1 ? 'año' : 'años'}`;
}

function PlayerChip({ player }) {
  const name = player.name || player.username || 'Anónimo';
  return (
    <span className={`${styles.playerChip} ${player.win ? styles.playerChipWinner : ''}`}>
      {player.win && <span className={styles.winIcon} aria-label="Ganador">🏆</span>}
      <span className={styles.playerName}>{name}</span>
      {player.score && <span className={styles.playerScore}>{player.score}</span>}
    </span>
  );
}

function PlayCardMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const stop = (e) => e.stopPropagation();
  const handle = (e, fn) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div className={styles.playCardMenu} ref={ref} onClick={stop} onKeyDown={stop}>
      <button
        type="button"
        className={styles.playCardMenuBtn}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Acciones"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className={styles.playCardMenuPop} role="menu">
          {onEdit && (
            <button
              type="button"
              className={styles.playCardMenuItem}
              role="menuitem"
              onClick={(e) => handle(e, onEdit)}
            >
              Editar
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={`${styles.playCardMenuItem} ${styles.playCardMenuItemDanger}`}
              role="menuitem"
              onClick={(e) => handle(e, onDelete)}
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayCard({ play, onClick, onEdit, onDelete }) {
  const sortedPlayers = useMemo(() => {
    if (!play.players || play.players.length === 0) return [];
    return [...play.players].sort((a, b) => {
      if (a.win !== b.win) return a.win ? -1 : 1;
      const aPos = a.position ? Number(a.position) : 999;
      const bPos = b.position ? Number(b.position) : 999;
      if (Number.isFinite(aPos) && Number.isFinite(bPos) && aPos !== bPos) return aPos - bPos;
      return 0;
    });
  }, [play.players]);

  const truncatedComment = play.comments
    ? (play.comments.length > 80 ? `${play.comments.slice(0, 80)}…` : play.comments)
    : null;

  const interactive = typeof onClick === 'function';

  return (
    <div
      className={`${styles.playCard} ${interactive ? styles.playCardInteractive : ''}`}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className={styles.playThumb}>
        {play.gameThumbnail ? (
          <img src={play.gameThumbnail} alt={play.gameName || ''} loading="lazy" />
        ) : (
          <span className={styles.playThumbFallback}>🎲</span>
        )}
      </div>

      <div className={styles.playBody}>
        <div className={styles.playTopRow}>
          <span className={styles.playGameName}>{play.gameName || '—'}</span>
          <span className={styles.playDateBlock}>
            <span className={styles.playDateRelative}>{relativeDate(play.date)}</span>
            <span className={styles.playDateAbs}>{formatDate(play.date)}</span>
          </span>
          {(onEdit || onDelete) && (
            <PlayCardMenu onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>

        {sortedPlayers.length > 0 && (
          <div className={styles.playPlayers}>
            {sortedPlayers.map((p, i) => (
              <PlayerChip key={`${p.username || p.name || 'anon'}-${i}`} player={p} />
            ))}
          </div>
        )}

        <div className={styles.playTags}>
          {play.location && (
            <span className={styles.playTag}>
              <span className={styles.tagIcon}>📍</span>{play.location}
            </span>
          )}
          {play.duration > 0 && (
            <span className={styles.playTag}>
              <span className={styles.tagIcon}>⏱</span>{play.duration} min
            </span>
          )}
          {play.quantity > 1 && (
            <span className={styles.playTag}>×{play.quantity} partidas</span>
          )}
          {play.incomplete && (
            <span className={`${styles.playTag} ${styles.playTagWarn}`}>Incompleta</span>
          )}
          {truncatedComment && (
            <span className={styles.playTagComment}>
              <span className={styles.tagIcon}>💬</span>{truncatedComment}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
