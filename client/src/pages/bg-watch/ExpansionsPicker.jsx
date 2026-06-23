import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API } from "../../api/endpoints";
import DiceLoader from "../../components/shared/DiceLoader";
import PickerEmptyRow from "./PickerEmptyRow";
import styles from "./BgWatchProfile.module.css";

/**
 * Picker multi-select de expansiones del juego (para "Expansiones jugadas").
 * Trae todas las expansiones desde BGG (`/game/:id/expansiones`), filtra
 * client-side y togglea la selección (no cierra al elegir; se cierra con la ✕
 * o clickeando fuera, manejado por el contenedor en PlayForm).
 *
 * Props:
 *   gameId, selected [{ id, name }], onToggle(exp), onClose().
 */
export default function ExpansionsPicker({
  gameId,
  selected,
  onToggle,
  onClose,
}) {
  const { t } = useTranslation("bgwatch");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!gameId) return undefined;
    const ac = new AbortController();
    setLoading(true);
    setError(false);
    axios
      .get(API.bgg.GAME_EXPANSIONES(gameId), { signal: ac.signal })
      .then(({ data }) => setItems(data.items || []))
      .catch((e) => {
        if (!axios.isCancel(e)) setError(true);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [gameId]);

  const selectedIds = new Set((selected || []).map((e) => e.id));
  const term = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      term ? items.filter((e) => e.name.toLowerCase().includes(term)) : items,
    [items, term],
  );
  const isEmpty = !loading && visible.length === 0;

  return (
    <div className={styles.modalSection}>
      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder={t("expansionsPicker.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("expansionsPicker.searchAria")}
          autoFocus
        />
        <button
          type="button"
          className={styles.playerPickerCancel}
          onClick={onClose}
          aria-label={t("expansionsPicker.close")}
        >
          ✕
        </button>
      </div>

      {loading && (
        <DiceLoader
          text={t("expansionsPicker.searching")}
          hint={t("expansionsPicker.searchingHint")}
        />
      )}

      {/* Estado vacío como una sola fila compacta (mismo alto que el loader),
          tanto filtrando sin resultados como sin expansiones listadas. */}
      {isEmpty && (
        <PickerEmptyRow>
          {term
            ? t("expansionsPicker.noMatch", { term })
            : t("expansionsPicker.emptyList")}
        </PickerEmptyRow>
      )}

      {visible.length > 0 && (
        <ul className={styles.gameSearchList}>
          {visible.map((e) => {
            const on = selectedIds.has(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className={`${styles.gameSearchItem} ${on ? styles.expSelected : ""}`}
                  onClick={() => onToggle(e)}
                  aria-pressed={on}
                >
                  <span className={styles.expCheck}>{on ? "✓" : "+"}</span>
                  {e.thumbnail ? (
                    <img
                      src={e.thumbnail}
                      alt={e.name}
                      className={styles.gameSearchThumb}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.gameSearchThumbFallback}>🎲</span>
                  )}
                  <div className={styles.gameSearchInfo}>
                    <span className={styles.gameSearchName}>{e.name}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className={styles.dimText}>{t("expansionsPicker.loadError")}</p>
      )}
    </div>
  );
}
