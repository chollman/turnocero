import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import BackButton from "../../components/shared/BackButton";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./BgWatchComunidad.module.css";

function fmtWinRate(stats) {
  if (stats.winRate == null) return "—";
  return `${Math.round(stats.winRate * 100)}%`;
}

export default function ComunidadJuegoDetail() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setData(null);
    setError(false);
    axios
      .get(API.bgg.COMUNIDAD_JUEGO(gameId), { signal: ac.signal })
      .then(({ data: d }) => setData(d))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [gameId]);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.errorMsg}>No se pudo cargar el juego.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loading}>Cargando…</div>
        </div>
      </div>
    );
  }

  const { game, stats, owners } = data;
  const name = game?.name || `Juego ${gameId}`;
  const cover = game?.image || game?.thumbnail;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackButton onClick={() => navigate(-1)} flush>
          Volver
        </BackButton>

        <div className={styles.detailHero}>
          <div className={styles.detailThumb}>
            {cover ? <img src={cover} alt={name} /> : <span>?</span>}
          </div>
          <div className={styles.detailInfo}>
            <div className={styles.eyebrow}>BG WATCH · COMUNIDAD</div>
            <h1 className={styles.heroTitle}>{name}</h1>
            {game?.year ? (
              <span className={styles.feedMeta}>{game.year}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalPlays}</span>
            <span className={styles.statLabel}>Partidas</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.memberCount}</span>
            <span className={styles.statLabel}>Jugadores</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{fmtWinRate(stats)}</span>
            <span className={styles.statLabel}>Win-rate</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.avgDuration != null ? `${stats.avgDuration}′` : "—"}
            </span>
            <span className={styles.statLabel}>Duración prom.</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.avgScore != null ? stats.avgScore : "—"}
            </span>
            <span className={styles.statLabel}>Score prom.</span>
          </div>
        </div>

        {stats.topPlayers?.length > 0 && (
          <section>
            <h2 className={styles.sectionTitle}>Quién lo jugó más</h2>
            <ol className={styles.leaderboard}>
              {stats.topPlayers.map((p, i) => (
                <li key={p.bggUsername} className={styles.lbRow}>
                  <Link
                    to={`/bg-watch/${encodeURIComponent(p.bggUsername)}`}
                    className={styles.lbLink}
                  >
                    <span className={styles.lbRank}>{i + 1}</span>
                    {p.user ? (
                      <Avatar user={p.user} size="sm" />
                    ) : (
                      <span className={styles.lbDot} aria-hidden="true" />
                    )}
                    <span className={styles.lbName}>
                      {p.user ? getUserDisplay(p.user).name : p.bggUsername}
                    </span>
                    <span className={styles.lbValue}>{p.numPlays}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <h2 className={styles.sectionTitle}>¿Quién lo tiene?</h2>
          {owners.length === 0 ? (
            <p className={styles.feedMeta}>
              Ningún miembro tiene este juego en su colección (o sus colecciones
              son privadas).
            </p>
          ) : (
            <>
              <div className={styles.ownerList}>
                {owners.map((o) => (
                  <Link
                    key={o.bggUsername}
                    to={`/bg-watch/${encodeURIComponent(o.bggUsername)}`}
                    className={styles.ownerChip}
                  >
                    {o.user ? (
                      <Avatar user={o.user} size="xs" />
                    ) : (
                      <span className={styles.lbDot} aria-hidden="true" />
                    )}
                    {o.user ? getUserDisplay(o.user).name : o.bggUsername}
                  </Link>
                ))}
              </div>
              <p className={styles.ownerNote}>
                La colección puede estar incompleta si algún perfil es privado.
              </p>
            </>
          )}
          <div className={styles.ctaRow}>
            <Link to="/mesas/crear" className={styles.ctaBtn}>
              Armar una mesa
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
