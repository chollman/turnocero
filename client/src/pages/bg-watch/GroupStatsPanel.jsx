import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API } from "../../api/endpoints";
import { getLocale } from "../../utils/locale";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import PlayCard from "./PlayCard";
import Pagination from "./Pagination";
import styles from "./GroupStatsPanel.module.css";

function formatShortDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return new Date(y, m - 1, d).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function rosterDisplayName(t, row, userMap) {
  if (row.overlayName) return row.overlayName;
  const turnoceroUser = row.username
    ? userMap?.[row.username.toLowerCase()]
    : null;
  if (turnoceroUser) return turnoceroUser.displayName || turnoceroUser.username;
  return row.name || row.username || t("groupStats.rosterFallbackName");
}

/**
 * "Con este grupo": botón que despliega las estadísticas de TODAS las partidas
 * del dueño con exactamente el mismo grupo de jugadores que la partida abierta
 * (victorias por integrante, juegos del grupo, primera/última vez) + el listado
 * de las otras partidas. Fetch perezoso al primer despliegue.
 */
export default function GroupStatsPanel({ bggUsername, playId, userMap }) {
  const navigate = useNavigate();
  const { t } = useTranslation("bgwatch");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) return undefined;
    const ac = new AbortController();
    setError(false);
    axios
      .get(API.bgg.PARTIDA_GRUPO(bggUsername, playId), {
        params: { page },
        signal: ac.signal,
      })
      .then(({ data: d }) => setData(d))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [open, bggUsername, playId, page]);

  // Reset al cambiar de partida (navegación detalle → detalle).
  useEffect(() => {
    setOpen(false);
    setData(null);
    setPage(1);
  }, [playId]);

  const stats = data?.stats;
  const roster = data?.roster || [];
  const otherPlays = (data?.plays || []).filter((p) => p.id !== playId);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <section className={styles.wrap}>
      <button
        type="button"
        className={`${styles.toggle} ${open ? styles.toggleOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.toggleLabel}>
          {t("groupStats.toggleLabel")}
        </span>
        <span className={styles.toggleHint}>
          {open ? t("groupStats.hide") : t("groupStats.show")}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.panel}>
          {error && (
            <p className={styles.errorText}>{t("groupStats.error")}</p>
          )}

          {!error && !data && (
            <div className={styles.loading}>{t("common.loading")}</div>
          )}

          {!error && data && (
            <>
              <div className={styles.summary}>
                <div className={styles.bigStat}>
                  <span className={styles.bigStatVal}>{stats.total}</span>
                  <span className={styles.bigStatLbl}>
                    {t("groupStats.playsTogether", { count: stats.total })}
                  </span>
                </div>
                {stats.firstPlayedDate && (
                  <div className={styles.summaryDates}>
                    <span>
                      {t("groupStats.first", {
                        date: formatShortDate(stats.firstPlayedDate),
                      })}
                    </span>
                    <span>
                      {t("groupStats.last", {
                        date: formatShortDate(stats.lastPlayedDate),
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.columns}>
                <div className={styles.col}>
                  <div className={styles.colLabel}>
                    <Meeple /> {t("groupStats.wins")}
                  </div>
                  <div className={styles.rankList}>
                    {roster.map((row) => {
                      const turnoceroUser = row.username
                        ? userMap?.[row.username.toLowerCase()]
                        : null;
                      const name = rosterDisplayName(t, row, userMap);
                      const pct = stats.total
                        ? Math.round((row.wins / stats.total) * 100)
                        : 0;
                      return (
                        <div key={row.key} className={styles.rankRow}>
                          {row.overlayAvatar?.url ? (
                            <Avatar
                              user={{
                                _id: row.username || row.name,
                                displayName: name,
                                avatar: row.overlayAvatar,
                              }}
                              size="xs"
                            />
                          ) : (
                            <Avatar
                              user={
                                turnoceroUser || {
                                  _id: row.key,
                                  username: row.username || name,
                                  displayName: name,
                                }
                              }
                              size="xs"
                            />
                          )}
                          <div className={styles.rankInfo}>
                            <div className={styles.rankName}>{name}</div>
                            <div className={styles.rankBar}>
                              <div
                                className={styles.rankBarFill}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className={styles.rankCount}>
                            {t("groupStats.winsCount", { count: row.wins })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.col}>
                  <div className={styles.colLabel}>
                    <Meeple /> {t("groupStats.groupGames")}
                  </div>
                  <div className={styles.rankList}>
                    {stats.byGame.slice(0, 6).map((g) => {
                      const max = stats.byGame[0]?.total || 1;
                      return (
                        <div
                          key={g.gameId || g.name}
                          className={styles.rankRow}
                        >
                          {g.thumbnail ? (
                            <img
                              src={g.thumbnail}
                              alt=""
                              className={styles.gameThumb}
                              loading="lazy"
                            />
                          ) : (
                            <span className={styles.gameThumbFallback}>🎲</span>
                          )}
                          <div className={styles.rankInfo}>
                            <div className={styles.rankName}>
                              {g.name || "—"}
                            </div>
                            <div className={styles.rankBar}>
                              <div
                                className={`${styles.rankBarFill} ${styles.rankBarFillGold}`}
                                style={{ width: `${(g.total / max) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className={styles.rankCount}>
                            {t("groupStats.gameTimes", { n: g.total })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={styles.playsLabel}>
                <Meeple /> {t("groupStats.otherPlays")}
              </div>
              {otherPlays.length === 0 ? (
                <p className={styles.emptyText}>
                  {t("groupStats.noOtherPlays")}
                </p>
              ) : (
                <div className={styles.playsList}>
                  {otherPlays.map((p, i) => (
                    <PlayCard
                      key={p.id}
                      play={p}
                      index={i}
                      userMap={userMap}
                      bggUsername={bggUsername}
                      onClick={() =>
                        navigate(
                          `/bg-watch/${encodeURIComponent(bggUsername)}/partidas/${p.id}`,
                        )
                      }
                    />
                  ))}
                </div>
              )}
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={setPage}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
