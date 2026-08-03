import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useComunidadJuegoQuery } from "../../queries/bgWatch";
import Avatar from "../../components/shared/Avatar";
import BackButton from "../../components/shared/BackButton";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./BgWatchComunidad.module.css";

function fmtWinRate(t, stats) {
  if (stats.winRate == null) return "—";
  return t("juegoDetail.winRate", { n: Math.round(stats.winRate * 100) });
}

export default function ComunidadJuegoDetail() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("bgwatch");
  const { data, isError: error } = useComunidadJuegoQuery(gameId);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.errorMsg}>{t("juegoDetail.loadError")}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loading}>{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  const { game, stats, owners } = data;
  const name = game?.name || t("juegoDetail.gameFallback", { id: gameId });
  const cover = game?.image || game?.thumbnail;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <BackButton onClick={() => navigate(-1)} flush>
          {t("common.back")}
        </BackButton>

        <div className={styles.detailHero}>
          <div className={styles.detailThumb}>
            {cover ? <img src={cover} alt={name} /> : <span>?</span>}
          </div>
          <div className={styles.detailInfo}>
            <div className={styles.eyebrow}>{t("juegoDetail.brand")}</div>
            <h1 className={styles.heroTitle}>{name}</h1>
            {game?.year ? (
              <span className={styles.feedMeta}>{game.year}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.statRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalPlays}</span>
            <span className={styles.statLabel}>
              {t("juegoDetail.stats.partidas")}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.memberCount}</span>
            <span className={styles.statLabel}>
              {t("juegoDetail.stats.jugadores")}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{fmtWinRate(t, stats)}</span>
            <span className={styles.statLabel}>
              {t("juegoDetail.stats.winRate")}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.avgDuration != null
                ? t("juegoDetail.duration", { n: stats.avgDuration })
                : "—"}
            </span>
            <span className={styles.statLabel}>
              {t("juegoDetail.stats.avgDuration")}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.avgScore != null ? stats.avgScore : "—"}
            </span>
            <span className={styles.statLabel}>
              {t("juegoDetail.stats.avgScore")}
            </span>
          </div>
        </div>

        {stats.topPlayers?.length > 0 && (
          <section>
            <h2 className={styles.sectionTitle}>
              {t("juegoDetail.whoPlayedMost")}
            </h2>
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
          <h2 className={styles.sectionTitle}>{t("juegoDetail.whoHasIt")}</h2>
          {owners.length === 0 ? (
            <p className={styles.feedMeta}>{t("juegoDetail.noOwners")}</p>
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
              <p className={styles.ownerNote}>{t("juegoDetail.ownerNote")}</p>
            </>
          )}
          <div className={styles.ctaRow}>
            <Link to="/mesas/crear" className={styles.ctaBtn}>
              {t("juegoDetail.createTable")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
