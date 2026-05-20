import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ModalPortal from '../../components/shared/ModalPortal';
import Avatar from '../../components/shared/Avatar';
import { hasDisplayableScore } from './playerScore';
import styles from './BgWatchProfile.module.css';

function formatFullDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const KNOWN_COLORS = {
  red: '#d44',
  rojo: '#d44',
  blue: '#46c',
  azul: '#46c',
  green: '#3a3',
  verde: '#3a3',
  yellow: '#dc4',
  amarillo: '#dc4',
  black: '#222',
  negro: '#222',
  white: '#eee',
  blanco: '#eee',
  orange: '#e80',
  naranja: '#e80',
  purple: '#83b',
  morado: '#83b',
  violeta: '#83b',
  pink: '#e9a',
  rosa: '#e9a',
  brown: '#864',
  marron: '#864',
  marrón: '#864',
  gray: '#888',
  grey: '#888',
  gris: '#888',
};

function colorSwatch(name) {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  return KNOWN_COLORS[k] || k;
}

export default function PlayDetailModal({ play, userMap, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sortedPlayers = useMemo(() => {
    if (!play?.players) return [];
    return [...play.players].sort((a, b) => {
      if (a.win !== b.win) return a.win ? -1 : 1;
      const aPos = a.position ? Number(a.position) : 999;
      const bPos = b.position ? Number(b.position) : 999;
      if (Number.isFinite(aPos) && Number.isFinite(bPos) && aPos !== bPos) return aPos - bPos;
      return 0;
    });
  }, [play]);

  if (!play) return null;

  const hasDetails = play.location || play.duration > 0 || play.quantity > 1 || play.incomplete || play.nowinstats;

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div
          className={`${styles.modalCard} ${styles.modalCardWide}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modalHero}>
            <div className={styles.modalHeroThumb}>
              {play.gameThumbnail ? (
                <img src={play.gameThumbnail} alt={play.gameName || ''} />
              ) : (
                <span className={styles.playThumbFallback}>🎲</span>
              )}
            </div>
            <div className={styles.modalHeroInfo}>
              <h2 className={styles.modalGameName}>{play.gameName || 'Sin nombre'}</h2>
              <span className={styles.modalDateFull}>{formatFullDate(play.date) || '—'}</span>
              {play.gameId && (
                <a
                  href={`https://boardgamegeek.com/boardgame/${play.gameId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.modalGameLink}
                >
                  Ver en BoardGameGeek ↗
                </a>
              )}
            </div>
            <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
          </div>

          {sortedPlayers.length > 0 && (
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Jugadores</h3>
              <div className={styles.playerTableWrap}>
                <table className={styles.playerTable}>
                  <thead>
                    <tr>
                      <th className={styles.colCenter}>#</th>
                      <th>Jugador</th>
                      <th>Color</th>
                      <th className={styles.colNumeric}>Score</th>
                      <th className={styles.colNumeric}>Rating</th>
                      <th className={styles.colCenter} aria-label="Ganador">🏆</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((p, i) => {
                      const swatch = colorSwatch(p.color);
                      const turnoceroUser = p.username ? userMap?.[p.username.toLowerCase()] : null;
                      const displayName = turnoceroUser
                        ? (turnoceroUser.displayName || turnoceroUser.username)
                        : (p.name || 'Anónimo');
                      return (
                        <tr
                          key={`${p.username || p.name || 'anon'}-${i}`}
                          className={p.win ? styles.playerRowWinner : ''}
                        >
                          <td className={styles.colCenter}>{p.position || '—'}</td>
                          <td>
                            <div className={styles.playerCellName}>
                              {turnoceroUser && <Avatar user={turnoceroUser} size="xs" />}
                              {displayName}
                              {p.new && <span className={styles.newBadge}>nuevo</span>}
                            </div>
                            {turnoceroUser ? (
                              <Link
                                to={`/usuarios/${turnoceroUser._id}`}
                                className={styles.playerCellUsername}
                                title="Ver perfil en Turnocero"
                              >
                                @{turnoceroUser.username} · en Turnocero
                              </Link>
                            ) : (
                              p.username && (
                                <a
                                  href={`https://boardgamegeek.com/user/${p.username}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.playerCellUsername}
                                >
                                  @{p.username}
                                </a>
                              )
                            )}
                          </td>
                          <td>
                            {p.color ? (
                              <span className={styles.colorChip}>
                                <span
                                  className={styles.colorDot}
                                  style={swatch ? { background: swatch } : undefined}
                                />
                                {p.color}
                              </span>
                            ) : (
                              <span className={styles.dimText}>—</span>
                            )}
                          </td>
                          <td className={styles.colNumeric}>{hasDisplayableScore(p.score) ? p.score : <span className={styles.dimText}>—</span>}</td>
                          <td className={styles.colNumeric}>
                            {p.rating ? p.rating.toFixed(1) : <span className={styles.dimText}>—</span>}
                          </td>
                          <td className={styles.colCenter}>{p.win ? '🏆' : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {hasDetails && (
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Detalles</h3>
              <dl className={styles.detailsGrid}>
                {play.location && (<><dt>Ubicación</dt><dd>{play.location}</dd></>)}
                {play.duration > 0 && (<><dt>Duración</dt><dd>{play.duration} min</dd></>)}
                {play.quantity > 1 && (<><dt>Cantidad</dt><dd>{play.quantity} partidas</dd></>)}
                {play.incomplete && (<><dt>Estado</dt><dd className={styles.detailWarn}>Incompleta</dd></>)}
                {play.nowinstats && (<><dt>Stats</dt><dd>No cuenta para ranking</dd></>)}
              </dl>
            </section>
          )}

          {play.comments && (
            <section className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Comentarios</h3>
              <p className={styles.commentBody}>{play.comments}</p>
            </section>
          )}

          <div className={styles.modalActions}>
            <button className={styles.btnGhost} onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
