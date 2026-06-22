import { useTranslation } from "react-i18next";
import BggGameSearch from "../../../components/shared/BggGameSearch";
import styles from "../MathTradeDetail.module.css";

// Constructor de want list: agrega juegos vía BGG, los ordena por preferencia
// (el orden = rank) y permite quitarlos. `wants` es el array controlado y
// `onChange` recibe la nueva lista.
export default function WantListBuilder({ wants, onChange }) {
  const { t } = useTranslation();
  const add = (g) => {
    if (wants.some((w) => w.bggGameId === g.id)) return; // ya está
    onChange([
      ...wants,
      { bggGameId: g.id, gameName: g.name, thumbnail: g.thumbnail },
    ]);
  };

  const remove = (id) => onChange(wants.filter((w) => w.bggGameId !== id));

  const move = (idx, dir) => {
    const next = [...wants];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div>
      <span className={styles.formLabel}>{t("mathtrade:wantList.label")}</span>
      {wants.length === 0 && (
        <p className={styles.chainGive} style={{ marginBottom: 8 }}>
          {t("mathtrade:wantList.empty")}
        </p>
      )}
      {wants.map((w, idx) => (
        <div className={styles.wantRow} key={w.bggGameId}>
          <span className={styles.wantRank}>{idx + 1}</span>
          <span className={styles.wantName}>
            {w.gameName ||
              t("mathtrade:wantList.gameFallback", { id: w.bggGameId })}
          </span>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => move(idx, -1)}
            disabled={idx === 0}
            aria-label={t("mathtrade:wantList.moveUp")}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => move(idx, 1)}
            disabled={idx === wants.length - 1}
            aria-label={t("mathtrade:wantList.moveDown")}
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => remove(w.bggGameId)}
            aria-label={t("mathtrade:wantList.remove")}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <BggGameSearch
          onPick={add}
          clearOnPick
          autoFocus={false}
          placeholder={t("mathtrade:wantList.searchPlaceholder")}
        />
      </div>
    </div>
  );
}
