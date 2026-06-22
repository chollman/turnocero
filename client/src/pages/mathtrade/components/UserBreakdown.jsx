import { useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import Avatar from "../../../components/shared/Avatar";
import { getUserDisplay } from "../../../utils/userDisplay";
import styles from "../MathTradeDetail.module.css";

// Agrupa los resultados POR USUARIO: por cada participante, qué entrega y qué
// recibe (o "sin match"). Usa la lista completa de ítems si está disponible
// (incluye los no matcheados); si no, cae a derivarlo de las cadenas.
// `gameFallback` arma el nombre de fallback (#id) cuando no hay gameName.
function buildGroups(items, cycles, gameFallback) {
  if (items && items.length) {
    const nameByGame = new Map();
    for (const it of items) {
      if (!nameByGame.has(it.bggGameId))
        nameByGame.set(it.bggGameId, it.gameName);
    }
    const groups = new Map();
    for (const it of items) {
      const key = String(it.owner?._id || it.owner);
      if (!groups.has(key)) groups.set(key, { owner: it.owner, rows: [] });
      groups.get(key).rows.push({
        give: it.gameName || gameFallback(it.bggGameId),
        receive: it.traded
          ? nameByGame.get(it.matchedGameId) || gameFallback(it.matchedGameId)
          : null,
      });
    }
    return [...groups.values()];
  }
  const groups = new Map();
  for (const c of cycles || []) {
    for (const node of c.items) {
      const key = String(node.owner?._id || node.owner);
      if (!groups.has(key)) groups.set(key, { owner: node.owner, rows: [] });
      groups.get(key).rows.push({
        give: node.gameName || gameFallback(node.gameId),
        receive: node.receivesGameName || gameFallback(node.receivesGameId),
      });
    }
  }
  return [...groups.values()];
}

export default function UserBreakdown({ items, cycles, currentUserId }) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const gameFallback = (id) => t("mathtrade:chain.gameFallback", { id });
    const g = buildGroups(items, cycles, gameFallback);
    // El usuario actual primero, después por nombre.
    return g.sort((a, b) => {
      const aMine = String(a.owner?._id || a.owner) === String(currentUserId);
      const bMine = String(b.owner?._id || b.owner) === String(currentUserId);
      if (aMine !== bMine) return aMine ? -1 : 1;
      return getUserDisplay(a.owner).name.localeCompare(
        getUserDisplay(b.owner).name,
      );
    });
  }, [items, cycles, currentUserId, t]);

  if (groups.length === 0)
    return (
      <div className={styles.empty}>
        {t("mathtrade:userBreakdown.noParticipants")}
      </div>
    );

  return (
    <div>
      {groups.map((grp) => {
        const display = getUserDisplay(grp.owner);
        const isYou =
          currentUserId &&
          String(grp.owner?._id || grp.owner) === String(currentUserId);
        const tradedCount = grp.rows.filter((r) => r.receive).length;
        return (
          <div
            className={styles.userBlock}
            key={String(grp.owner?._id || grp.owner)}
          >
            <div className={styles.userHead}>
              <Avatar user={grp.owner} size="sm" />
              <span className={styles.userName}>
                {display.name}
                {isYou ? t("mathtrade:userBreakdown.you") : ""}
              </span>
              <span className={styles.userCount}>
                {t("mathtrade:userBreakdown.tradedCount", {
                  traded: tradedCount,
                  total: grp.rows.length,
                })}
              </span>
            </div>
            <div className={styles.userRows}>
              {grp.rows.map((r, i) => (
                <div
                  key={i}
                  className={`${styles.userRow} ${r.receive ? "" : styles.userRowMuted}`}
                >
                  <span>
                    <Trans
                      i18nKey="mathtrade:userBreakdown.give"
                      values={{ game: r.give }}
                      components={{ strong: <strong /> }}
                    />
                  </span>
                  {r.receive ? (
                    <span>
                      {" "}
                      <Trans
                        i18nKey="mathtrade:userBreakdown.receive"
                        values={{ game: r.receive }}
                        components={{
                          strong: <strong />,
                          arrow: <span className={styles.chainArrow} />,
                        }}
                      />
                    </span>
                  ) : (
                    <span>{t("mathtrade:userBreakdown.noMatch")}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
