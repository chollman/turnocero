import { useMemo } from "react";
import Avatar from "../../../components/shared/Avatar";
import { getUserDisplay } from "../../../utils/userDisplay";
import styles from "../MathTradeDetail.module.css";

// Agrupa los resultados POR USUARIO: por cada participante, qué entrega y qué
// recibe (o "sin match"). Usa la lista completa de ítems si está disponible
// (incluye los no matcheados); si no, cae a derivarlo de las cadenas.
function buildGroups(items, cycles) {
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
        give: it.gameName || `#${it.bggGameId}`,
        receive: it.traded
          ? nameByGame.get(it.matchedGameId) || `#${it.matchedGameId}`
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
        give: node.gameName || `#${node.gameId}`,
        receive: node.receivesGameName || `#${node.receivesGameId}`,
      });
    }
  }
  return [...groups.values()];
}

export default function UserBreakdown({ items, cycles, currentUserId }) {
  const groups = useMemo(() => {
    const g = buildGroups(items, cycles);
    // El usuario actual primero, después por nombre.
    return g.sort((a, b) => {
      const aMine = String(a.owner?._id || a.owner) === String(currentUserId);
      const bMine = String(b.owner?._id || b.owner) === String(currentUserId);
      if (aMine !== bMine) return aMine ? -1 : 1;
      return getUserDisplay(a.owner).name.localeCompare(
        getUserDisplay(b.owner).name,
      );
    });
  }, [items, cycles, currentUserId]);

  if (groups.length === 0)
    return <div className={styles.empty}>No hay participantes.</div>;

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
                {isYou ? " (vos)" : ""}
              </span>
              <span className={styles.userCount}>
                {tradedCount}/{grp.rows.length} intercambiados
              </span>
            </div>
            <div className={styles.userRows}>
              {grp.rows.map((r, i) => (
                <div
                  key={i}
                  className={`${styles.userRow} ${r.receive ? "" : styles.userRowMuted}`}
                >
                  <span>
                    entrega <strong>{r.give}</strong>
                  </span>
                  {r.receive ? (
                    <span>
                      {" "}
                      <span className={styles.chainArrow}>→</span> recibe{" "}
                      <strong>{r.receive}</strong>
                    </span>
                  ) : (
                    <span> · sin match</span>
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
