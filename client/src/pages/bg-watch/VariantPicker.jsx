import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useVariantesQuery } from "../../queries/bgWatch";
import styles from "./BgWatchProfile.module.css";

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

/**
 * Picker de variante/tablero (texto libre con autocompletado). Trae las
 * variantes que el usuario ya cargó para ese juego (`/variantes/:user/:gameId`)
 * y permite elegir una o escribir una nueva ("Usar «…»"). Single-select.
 *
 * Props:
 *   bggUsername, gameId, value (string), onPick(text), onClose().
 */
export default function VariantPicker({
  bggUsername,
  gameId,
  value,
  onPick,
  onClose,
}) {
  const { t } = useTranslation("bgwatch");
  const { data: items = [] } = useVariantesQuery(bggUsername, gameId);
  const [q, setQ] = useState("");

  const term = q.trim();
  const visible = term
    ? items.filter((v) => norm(v).includes(norm(term)))
    : items;
  const exact = items.some((v) => norm(v) === norm(term));
  const showCreate = term && !exact;

  const choose = (v) => {
    onPick(v);
    onClose?.();
  };

  return (
    <div className={styles.modalSection}>
      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder={t("variantPicker.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label={t("variantPicker.aria")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && term) {
              e.preventDefault();
              choose(term);
            }
          }}
        />
        <button
          type="button"
          className={styles.playerPickerCancel}
          onClick={onClose}
          aria-label={t("variantPicker.close")}
        >
          ✕
        </button>
      </div>

      {(visible.length > 0 || showCreate) && (
        <ul className={styles.gameSearchList}>
          {showCreate && (
            <li>
              <button
                type="button"
                className={styles.locationCreateBtn}
                onClick={() => choose(term)}
              >
                <span className={styles.gameSearchThumbFallback}>＋</span>
                <span className={styles.gameSearchInfo}>
                  {t("variantPicker.useTerm", { term })}
                </span>
              </button>
            </li>
          )}
          {visible.map((v) => (
            <li key={v}>
              <button
                type="button"
                className={`${styles.gameSearchItem} ${norm(v) === norm(value) ? styles.locationItemActive : ""}`}
                onClick={() => choose(v)}
              >
                <span className={styles.gameSearchThumbFallback}>🎲</span>
                <div className={styles.gameSearchInfo}>
                  <span className={styles.gameSearchName}>{v}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 && !showCreate && (
        <p className={styles.dimText}>{t("variantPicker.hint")}</p>
      )}
    </div>
  );
}
