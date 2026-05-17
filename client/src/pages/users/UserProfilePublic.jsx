import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import GameTile from '../../components/shared/GameTile';
import ProfileSkeleton from './ProfileSkeleton';
import styles from './UserProfilePublic.module.css';

function seedFromId(id = '') {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0;
  return s;
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} semana${Math.floor(days / 7) > 1 ? 's' : ''}`;
  if (days < 365) return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? 's' : ''}`;
}

function StatCard({ value, label, accent }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles.statCardAccent : ''}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function FavoriteGames({ games }) {
  if (!games || games.length === 0) return null;
  const max = games[0].count;
  return (
    <div className={styles.favSection}>
      <div className={styles.sectionLabel}>JUEGOS FAVORITOS</div>
      <div className={styles.gamesList}>
        {games.map((g, i) => (
          <div key={g.game} className={styles.gameRow}>
            <span className={styles.gameRank}>#{i + 1}</span>
            <span className={styles.gameName}>{g.game}</span>
            <div className={styles.gameBarWrap}>
              <div className={styles.gameBar} style={{ width: `${Math.round((g.count / max) * 100)}%` }} />
            </div>
            <span className={styles.gameCount}>{g.count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserProfilePublic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, refreshUser } = useAuth();
  const { notifyFriendAdded } = useNotifications();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relationship, setRelationship] = useState('none');
  const [friendLoading, setFriendLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`/api/users/${id}`)
      .then(({ data }) => {
        setProfile(data);
        setRelationship(data.relationship ?? 'none');
      })
      .catch(() => setError('No se pudo cargar el perfil'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFriendAction = async (action) => {
    setFriendLoading(true);
    try {
      if (action === 'request') {
        await axios.post(`/api/friends/${id}/request`);
        setRelationship('request_sent');
      } else if (action === 'cancel_request') {
        await axios.delete(`/api/friends/${id}/request`);
        setRelationship('none');
      } else if (action === 'accept') {
        await axios.post(`/api/friends/${id}/accept`);
        setRelationship('friends');
        notifyFriendAdded();
        refreshUser().catch(() => {});
      } else if (action === 'reject') {
        await axios.post(`/api/friends/${id}/reject`);
        setRelationship('none');
      } else if (action === 'unfriend') {
        await axios.delete(`/api/friends/${id}`);
        setRelationship('none');
        refreshUser().catch(() => {});
      }
    } catch {
      // silently ignore
    } finally {
      setFriendLoading(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCenter}>
          <p>{error || 'Usuario no encontrado'}</p>
          <button className={styles.backBtn} onClick={() => navigate('/usuarios')}>
            ← Volver a jugadores
          </button>
        </div>
      </div>
    );
  }

  const { stats } = profile;
  const displayName = profile.displayName ||
    [profile.nombre, profile.apellido].filter(Boolean).join(' ') ||
    profile.username;
  const seed = seedFromId(profile._id || id);
  const joinYear = profile.createdAt ? new Date(profile.createdAt).getFullYear() : null;

  const contactParts = [
    profile.direccion?.texto,
    profile.telegram ? '✈️ Telegram' : null,
    profile.celular ? '📱 Celular' : null,
    profile.bggUsername ? '🎲 BG Watch' : null,
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      {/* GameTile hero banner */}
      <div className={styles.banner}>
        <GameTile game={profile.username} seed={seed} size="100%" />
        <div className={styles.bannerOverlay} />
      </div>

      <div className={styles.inner}>
        {/* Back button */}
        <button className={styles.backBtn} onClick={() => navigate('/usuarios')}>
          ← Jugadores
        </button>

        {/* Hero row: avatar + name + actions */}
        <div className={styles.heroRow}>
          <div className={styles.avatar}>
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.eyebrow}>
              ◆ PERFIL{joinYear ? ` · DESDE ${joinYear}` : ''}
            </div>
            <h1 className={styles.heroTitle}>{displayName}</h1>
            <div className={styles.heroSub}>
              @{profile.username}
              {contactParts.length > 0 && ` · ${contactParts.join(' · ')}`}
            </div>

            {currentUser && currentUser._id !== id && (
              <div className={styles.friendActions}>
                {relationship === 'none' && (
                  <button className={styles.friendBtnPrimary} onClick={() => handleFriendAction('request')} disabled={friendLoading}>
                    Agregar amigo
                  </button>
                )}
                {relationship === 'request_sent' && (
                  <button className={styles.friendBtnMuted} onClick={() => handleFriendAction('cancel_request')} disabled={friendLoading}>
                    Solicitud enviada · Cancelar
                  </button>
                )}
                {relationship === 'request_received' && (
                  <div className={styles.friendBtnGroup}>
                    <button className={styles.friendBtnAccept} onClick={() => handleFriendAction('accept')} disabled={friendLoading}>
                      ✓ Aceptar
                    </button>
                    <button className={styles.friendBtnMuted} onClick={() => handleFriendAction('reject')} disabled={friendLoading}>
                      Rechazar
                    </button>
                  </div>
                )}
                {relationship === 'friends' && (
                  <div className={styles.friendBtnGroup}>
                    <span className={styles.friendsBadge}>✓ Amigos</span>
                    <button className={styles.friendBtnUnfriend} onClick={() => handleFriendAction('unfriend')} disabled={friendLoading}>
                      Desamigar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          <StatCard value={stats.totalGamesPlayed} label="Partidas jugadas" accent />
          <StatCard value={stats.tablesHosted.total} label="Mesas creadas" />
          <StatCard value={stats.tablesAsPlayer.total} label="Como jugador" />
          <StatCard value={stats.tablesHosted.active} label="Mesas activas" />
          <StatCard value={profile.friendsCount} label="Amigos" />
          <StatCard value={stats.compartidas} label="Publicaciones" />
          <StatCard value={stats.likesReceived} label="Likes recibidos" />
        </div>

        {/* Two-column layout */}
        <div className={styles.layout}>
          {/* Left: contact + favorites */}
          <div className={styles.leftCol}>
            {(profile.direccion?.texto || profile.telegram || profile.celular || profile.bggUsername) && (
              <div className={styles.infoCard}>
                <div className={styles.sectionLabel}>CONTACTO</div>
                <div className={styles.infoList}>
                  {profile.direccion?.texto && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>📍</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>Zona</span>
                        <span className={styles.infoValue}>{profile.direccion.texto}</span>
                      </div>
                    </div>
                  )}
                  {profile.telegram && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>✈️</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>Telegram</span>
                        <span className={styles.infoValue}>@{profile.telegram}</span>
                      </div>
                    </div>
                  )}
                  {profile.celular && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>📱</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>Celular</span>
                        <span className={styles.infoValue}>{profile.celular}</span>
                      </div>
                    </div>
                  )}
                  {profile.bggUsername && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoIcon}>🎲</span>
                      <div className={styles.infoText}>
                        <span className={styles.infoLabel}>BG Watch</span>
                        <Link to={`/bg-watch/${profile.bggUsername}`} className={styles.infoLink}>
                          {profile.bggUsername}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <FavoriteGames games={stats.favoriteGames} />

            {stats.lastActivity && (
              <div className={styles.activityHint}>
                Última actividad {timeAgo(stats.lastActivity)}
              </div>
            )}
          </div>

          {/* Right: breakdown */}
          <div className={styles.rightCol}>
            <div className={styles.infoCard}>
              <div className={styles.sectionLabel}>MESAS COMO ANFITRIÓN</div>
              <div className={styles.breakdown}>
                <div className={styles.breakdownItem}>
                  <span className={`${styles.breakdownDot} ${styles.dotOpen}`} />
                  <span className={styles.breakdownLabel}>Abiertas</span>
                  <span className={styles.breakdownValue}>{stats.tablesHosted.open}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={`${styles.breakdownDot} ${styles.dotFull}`} />
                  <span className={styles.breakdownLabel}>Llenas</span>
                  <span className={styles.breakdownValue}>{stats.tablesHosted.full}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={`${styles.breakdownDot} ${styles.dotCancelled}`} />
                  <span className={styles.breakdownLabel}>Canceladas</span>
                  <span className={styles.breakdownValue}>{stats.tablesHosted.cancelled}</span>
                </div>
                {stats.tablesHosted.total > 0 && (
                  <div className={`${styles.breakdownItem} ${styles.breakdownSuccess}`}>
                    <span className={`${styles.breakdownDot} ${styles.dotSuccess}`} />
                    <span className={styles.breakdownLabel}>Tasa de éxito</span>
                    <span className={`${styles.breakdownValue} ${styles.breakdownValueSuccess}`}>
                      {Math.round(((stats.tablesHosted.total - stats.tablesHosted.cancelled) / stats.tablesHosted.total) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {stats.totalGamesPlayed > 0 && (
              <div className={styles.infoCard}>
                <div className={styles.sectionLabel}>ROL EN PARTIDAS</div>
                <div className={styles.ratioWrap}>
                  <div className={styles.ratioLabels}>
                    <span>Anfitrión</span>
                    <span>Jugador</span>
                  </div>
                  <div className={styles.ratioBar}>
                    <div
                      className={styles.ratioFill}
                      style={{ width: `${Math.round((stats.tablesHosted.active / stats.totalGamesPlayed) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.ratioValues}>
                    <span>{Math.round((stats.tablesHosted.active / stats.totalGamesPlayed) * 100)}%</span>
                    <span>{Math.round((stats.tablesAsPlayer.active / stats.totalGamesPlayed) * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {profile.createdAt && (
              <div className={styles.miembroCard}>
                <div className={styles.sectionLabel}>MIEMBRO DESDE</div>
                <div className={styles.miembroDate}>{formatDate(profile.createdAt)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
