import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import styles from './UserProfilePublic.module.css';

function StatCard({ value, label, highlight }) {
  return (
    <div className={`${styles.statCard} ${highlight ? styles.statCardHighlight : ''}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <div className={styles.infoText}>
        <span className={styles.infoLabel}>{label}</span>
        <span className={styles.infoValue}>{value}</span>
      </div>
    </div>
  );
}

function FavoriteGames({ games }) {
  if (!games || games.length === 0) return null;
  const max = games[0].count;
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>Juegos favoritos</p>
      <div className={styles.gamesList}>
        {games.map((g, i) => (
          <div key={g.game} className={styles.gameRow}>
            <span className={styles.gameRank}>#{i + 1}</span>
            <span className={styles.gameName}>{g.game}</span>
            <div className={styles.gameBarWrap}>
              <div
                className={styles.gameBar}
                style={{ width: `${Math.round((g.count / max) * 100)}%` }}
              />
            </div>
            <span className={styles.gameCount}>{g.count}×</span>
          </div>
        ))}
      </div>
    </div>
  );
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

export default function UserProfilePublic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
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
      } else if (action === 'reject') {
        await axios.post(`/api/friends/${id}/reject`);
        setRelationship('none');
      } else if (action === 'unfriend') {
        await axios.delete(`/api/friends/${id}`);
        setRelationship('none');
      }
    } catch {
      // silently ignore
    } finally {
      setFriendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <span className={styles.loadingDice}>🎲</span>
          <p>Cargando perfil…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p>{error || 'Usuario no encontrado'}</p>
          <button className={styles.backBtn} onClick={() => navigate('/users')}>
            ← Volver a jugadores
          </button>
        </div>
      </div>
    );
  }

  const { stats } = profile;
  const displayName = profile.displayName ||
    [profile.nombre, profile.apellido].filter(Boolean).join(' ');

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/users')}>
        ← Jugadores
      </button>

      <div className={styles.layout}>

        {/* Left column */}
        <div className={styles.leftCol}>

          {/* Profile hero */}
          <div className={styles.heroCard}>
            <div className={styles.heroAvatar}>
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className={styles.heroInfo}>
              <p className={styles.heroUsername}>@{profile.username}</p>
              {displayName && <p className={styles.heroName}>{displayName}</p>}
              <div className={styles.heroMeta}>
                <span className={styles.metaItem}>
                  Miembro desde {formatDate(profile.createdAt)}
                </span>
                {stats.lastActivity && (
                  <span className={styles.metaItem}>
                    Última actividad {timeAgo(stats.lastActivity)}
                  </span>
                )}
              </div>
              {currentUser && currentUser._id !== id && (
                <div className={styles.friendActions}>
                  {relationship === 'none' && (
                    <button
                      className={styles.friendBtn}
                      onClick={() => handleFriendAction('request')}
                      disabled={friendLoading}
                    >
                      ➕ Agregar amigo
                    </button>
                  )}
                  {relationship === 'request_sent' && (
                    <button
                      className={`${styles.friendBtn} ${styles.friendBtnMuted}`}
                      onClick={() => handleFriendAction('cancel_request')}
                      disabled={friendLoading}
                    >
                      Solicitud enviada · Cancelar
                    </button>
                  )}
                  {relationship === 'request_received' && (
                    <div className={styles.friendBtnGroup}>
                      <button
                        className={`${styles.friendBtn} ${styles.friendBtnAccept}`}
                        onClick={() => handleFriendAction('accept')}
                        disabled={friendLoading}
                      >
                        ✓ Aceptar
                      </button>
                      <button
                        className={`${styles.friendBtn} ${styles.friendBtnMuted}`}
                        onClick={() => handleFriendAction('reject')}
                        disabled={friendLoading}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                  {relationship === 'friends' && (
                    <div className={styles.friendBtnGroup}>
                      <span className={styles.friendsBadge}>✓ Amigos</span>
                      <button
                        className={`${styles.friendBtn} ${styles.friendBtnUnfriend}`}
                        onClick={() => handleFriendAction('unfriend')}
                        disabled={friendLoading}
                      >
                        Desamigar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contact info */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Información de contacto</p>
            <div className={styles.infoList}>
              <InfoRow icon="📍" label="Zona" value={profile.direccion?.texto} />
              <InfoRow
                icon="✈️"
                label="Telegram"
                value={profile.telegram ? `@${profile.telegram}` : null}
              />
              <InfoRow icon="📱" label="Celular" value={profile.celular} />
              {!profile.direccion?.texto && !profile.telegram && !profile.celular && (
                <p className={styles.noInfo}>Sin información de contacto pública</p>
              )}
            </div>
          </div>

          {/* Favorite games — mobile visible inside left col on large, separate on small */}
          <div className={styles.favoritesInline}>
            <FavoriteGames games={stats.favoriteGames} />
          </div>
        </div>

        {/* Right column */}
        <div className={styles.rightCol}>

          {/* Stats grid */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Estadísticas</p>
            <div className={styles.statsGrid}>
              <StatCard
                value={stats.totalGamesPlayed}
                label="Partidas jugadas"
                highlight
              />
              <StatCard
                value={stats.tablesHosted.total}
                label="Mesas creadas"
              />
              <StatCard
                value={stats.tablesAsPlayer.total}
                label="Mesas como jugador"
              />
              <StatCard
                value={stats.tablesHosted.active}
                label="Mesas activas (host)"
              />
            </div>
          </div>

          {/* Host breakdown */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Mesas como anfitrión</p>
            <div className={styles.breakdown}>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} data-status="open" />
                <span className={styles.breakdownLabel}>Abiertas</span>
                <span className={styles.breakdownValue}>{stats.tablesHosted.open}</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} data-status="full" />
                <span className={styles.breakdownLabel}>Llenas</span>
                <span className={styles.breakdownValue}>{stats.tablesHosted.full}</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} data-status="cancelled" />
                <span className={styles.breakdownLabel}>Canceladas</span>
                <span className={styles.breakdownValue}>{stats.tablesHosted.cancelled}</span>
              </div>
            </div>
          </div>

          {/* Favorite games desktop */}
          <div className={styles.favoritesDesktop}>
            <FavoriteGames games={stats.favoriteGames} />
          </div>

        </div>
      </div>
    </div>
  );
}
