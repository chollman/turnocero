import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import { getUserDisplay } from "../../utils/userDisplay";
import PlayCard from "./PlayCard";
import PlayCardSkeleton from "./PlayCardSkeleton";
import PlayDetailModal from "./PlayDetailModal";
import Pagination from "./Pagination";
import useBggUserMap from "./useBggUserMap";
import comu from "./BgWatchComunidad.module.css";
import styles from "./JugadorDetail.module.css";

const PLAYS_PAGE_SIZE = 10;

function pct(part, total) {
  if (!total) return null;
  return Math.round((part / total) * 100);
}

// "user" para <Avatar> a partir del header del jugador (linked gana su avatar).
function playerAvatarUser(player) {
  if (player.linkedUser) return player.linkedUser;
  return {
    _id: player.key,
    displayName: player.name,
    username: player.username,
    avatar: player.avatar || undefined,
  };
}

/**
 * Detalle de un co-jugador del roster (pestaña "Jugadores"): head-to-head vs el
 * dueño del perfil, estadísticas y la lista de partidas compartidas. Solo
 * dueño/admin (el endpoint también lo bloquea con 403).
 */
export default function JugadorDetail() {
  const { bggUsername, playerKey } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isOwnProfile =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canView = isOwnProfile || !!user?.isAdmin;

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [openPlay, setOpenPlay] = useState(null);
  const [showH2h, setShowH2h] = useState(false);

  useEffect(() => {
    if (!canView) return undefined;
    const ac = new AbortController();
    setError(false);
    axios
      .get(API.bgg.JUGADOR_DETALLE(bggUsername, playerKey), {
        params: { page },
        signal: ac.signal,
      })
      .then(({ data: d }) => setData(d))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [bggUsername, playerKey, page, canView]);

  // Reiniciar la página (y ocultar el H2H) al cambiar de jugador.
  useEffect(() => {
    setPage(1);
    setData(null);
    setShowH2h(false);
  }, [playerKey]);

  const userMap = useBggUserMap(data?.plays);

  // Gate de cliente: solo dueño/admin.
  if (!canView) {
    return <Navigate to={`/bg-watch/${bggUsername}/partidas`} replace />;
  }

  if (error) {
    return (
      <div className={comu.page}>
        <div className={comu.inner}>
          <button
            type="button"
            className={comu.backBtn}
            onClick={() => navigate(-1)}
          >
            ← Volver
          </button>
          <p className={comu.errorMsg}>No se pudo cargar el jugador.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={comu.page}>
        <div className={comu.inner}>
          <div className={comu.loading}>Cargando…</div>
        </div>
      </div>
    );
  }

  const { player, h2h, stats, plays, total } = data;
  const totalPages = Math.ceil((total || 0) / PLAYS_PAGE_SIZE);

  const ownerName =
    isOwnProfile && user ? getUserDisplay(user).name : bggUsername;
  const ownerAvatarUser =
    isOwnProfile && user
      ? user
      : {
          _id: `owner:${bggUsername}`,
          displayName: bggUsername,
          username: bggUsername,
        };
  const playerName = player.name || player.username || "Jugador";
  const playerWinRate = pct(h2h.playerWins, total);

  return (
    <div className={comu.page}>
      <div className={comu.inner}>
        <button
          type="button"
          className={comu.backBtn}
          onClick={() => navigate(-1)}
        >
          ← Volver
        </button>

        <header className={styles.playerHeader}>
          <Avatar user={playerAvatarUser(player)} size="xl" />
          <div className={styles.playerHeaderInfo}>
            <div className={comu.eyebrow}>
              <Meeple />
              BG WATCH · JUGADOR
            </div>
            <h1 className={styles.playerName}>
              {playerName}
              {player.username && (
                <span className={styles.playerHandle}> @{player.username}</span>
              )}
            </h1>
            <div className={styles.headerTags}>
              {player.isLinked && (
                <span className={styles.tagFriend}>miembro TurnoCero</span>
              )}
              {player.isSelf && <span className={styles.tagSelf}>sos vos</span>}
            </div>
            <div className={styles.headerLinks}>
              {player.isLinked && player.linkedUser?._id && (
                <Link
                  to={`/usuarios/${player.linkedUser._id}`}
                  className={comu.h2hName}
                >
                  Ver perfil →
                </Link>
              )}
              {player.isLinked && player.username && (
                <Link
                  to={`/bg-watch/comunidad/h2h/${encodeURIComponent(
                    bggUsername,
                  )}/${encodeURIComponent(player.username)}`}
                  className={comu.h2hName}
                >
                  Mano a mano de comunidad →
                </Link>
              )}
            </div>
          </div>
        </header>

        {total === 0 ? (
          <p className={comu.heroSub}>
            Todavía no hay partidas tuyas con este jugador.
          </p>
        ) : (
          <>
            {/* Head-to-head: dueño vs jugador. No se muestra al entrar; se
                revela al clickear el botón. */}
            {showH2h ? (
              <div className={comu.h2hBoard}>
                <div className={comu.h2hSide}>
                  <Avatar user={ownerAvatarUser} size="lg" />
                  <span className={comu.h2hName}>{ownerName}</span>
                </div>
                <div className={comu.h2hScore}>
                  <span className={comu.h2hWins}>{h2h.ownerWins}</span>
                  <span className={comu.h2hDash}>–</span>
                  <span className={comu.h2hWins}>{h2h.playerWins}</span>
                  {h2h.draws > 0 && (
                    <span className={comu.h2hDraws}>
                      {h2h.draws} sin decidir
                    </span>
                  )}
                </div>
                <div className={comu.h2hSide}>
                  <Avatar user={playerAvatarUser(player)} size="lg" />
                  <span className={comu.h2hName}>{playerName}</span>
                </div>
              </div>
            ) : (
              <div className={styles.h2hReveal}>
                <button
                  type="button"
                  className={styles.h2hRevealBtn}
                  onClick={() => setShowH2h(true)}
                >
                  Ver mano a mano
                </button>
              </div>
            )}

            {/* Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{total}</span>
                <span className={styles.statLabel}>
                  partida{total === 1 ? "" : "s"} juntas
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {playerWinRate == null ? "—" : `${playerWinRate}%`}
                </span>
                <span className={styles.statLabel}>victorias del jugador</span>
              </div>
              {stats.firstPlayedDate && (
                <div className={styles.statCard}>
                  <span className={styles.statValueSm}>
                    {stats.firstPlayedDate}
                  </span>
                  <span className={styles.statLabel}>primera juntada</span>
                </div>
              )}
              {stats.lastPlayedDate && (
                <div className={styles.statCard}>
                  <span className={styles.statValueSm}>
                    {stats.lastPlayedDate}
                  </span>
                  <span className={styles.statLabel}>última juntada</span>
                </div>
              )}
            </div>

            {/* Por juego */}
            {stats.byGame?.length > 0 && (
              <section>
                <h2 className={comu.sectionTitle}>Por juego</h2>
                <ul className={comu.byGameList}>
                  {stats.byGame.map((g) => (
                    <li
                      key={g.gameId || g.name || "?"}
                      className={comu.byGameRow}
                    >
                      <span className={comu.byGameName}>
                        {g.name || `Juego ${g.gameId}`}
                      </span>
                      <span className={comu.byGameScore}>
                        {g.ownerWins} – {g.playerWins}
                        <span className={comu.byGameTotal}>
                          {" "}
                          ({g.total} {g.total === 1 ? "partida" : "partidas"})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Partidas */}
            <section>
              <h2 className={comu.sectionTitle}>Partidas</h2>
              <div className={styles.playsList}>
                {!plays ? (
                  [0, 1, 2].map((i) => <PlayCardSkeleton key={i} />)
                ) : (
                  <>
                    {plays.map((play, i) => (
                      <PlayCard
                        key={play.id}
                        play={play}
                        index={i}
                        userMap={userMap}
                        onClick={() => setOpenPlay(play)}
                      />
                    ))}
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPage={(p) => {
                        setPage(p);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {openPlay && (
        <PlayDetailModal
          play={openPlay}
          userMap={userMap}
          onClose={() => setOpenPlay(null)}
        />
      )}
    </div>
  );
}
