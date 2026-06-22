import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { API } from "../../api/endpoints";
import DiceLoader from "./DiceLoader";
import styles from "./BggGameSearch.module.css";

/**
 * Buscador BGG reusable. Input con debounce 300ms + dropdown de resultados.
 *
 * Reusado por:
 *   - CreatePlayModal (BG Watch) — agregar un play
 *   - EventoLudotecaPicker — agregar un juego a la ludoteca del evento
 *
 * Props:
 *   onPick({ id, name, thumbnail, image, year }) — callback cuando el user elige.
 *   placeholder?: string — texto del input. Default "Buscá un juego en BGG…"
 *   autoFocus?: boolean — default true. Útil para modales.
 *   minChars?: number — caracteres mínimos antes de buscar. Default 3 (BGG
 *                       devuelve mucho ruido con queries cortas).
 */
export default function BggGameSearch({
  onPick,
  placeholder,
  autoFocus = true,
  minChars = 3,
  clearOnPick = false,
}) {
  const { t } = useTranslation();
  // El placeholder por defecto se resuelve acá (no en el param) porque `t` no
  // está disponible en la firma. Uno pasado por el caller gana.
  const resolvedPlaceholder = placeholder ?? t("shared:bggSearch.placeholder");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(q, 300);
  const reqId = useRef(0);
  const inputRef = useRef(null);

  // Cuando se permite agregar varios (juntada), tras elegir limpiamos el input
  // y los resultados para buscar otro juego de cero, y devolvemos el foco al
  // input para encadenar búsquedas sin tener que volver a clickearlo.
  const handlePick = (g) => {
    onPick?.({
      id: g.id,
      name: g.name,
      thumbnail: g.thumbnail,
      image: g.image,
      year: g.year,
    });
    if (clearOnPick) {
      setQ("");
      setResults([]);
      reqId.current += 1; // descartar respuestas en vuelo
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }
    const myReq = ++reqId.current;
    setLoading(true);
    axios
      .get(API.bgg.SEARCH, { params: { q: term } })
      .then(({ data }) => {
        // Descartar respuestas viejas si llegaron fuera de orden.
        if (myReq !== reqId.current) return;
        setResults(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (myReq === reqId.current) setResults([]);
      })
      .finally(() => {
        if (myReq === reqId.current) setLoading(false);
      });
  }, [debounced, minChars]);

  const showEmpty =
    !loading && debounced.trim().length >= minChars && results.length === 0;

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder={resolvedPlaceholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        aria-label={t("shared:bggSearch.inputAria")}
      />
      {loading && (
        <DiceLoader
          text={t("shared:bggSearch.loading")}
          hint={t("shared:bggSearch.loadingHint")}
        />
      )}
      {showEmpty && (
        <p className={styles.dim}>{t("shared:bggSearch.noResults")}</p>
      )}
      {results.length > 0 && (
        <ul className={styles.list} role="listbox">
          {results.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => handlePick(g)}
              >
                {g.thumbnail ? (
                  <img
                    src={g.thumbnail}
                    alt={g.name}
                    className={styles.thumb}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.thumbFallback} aria-hidden="true">
                    🎲
                  </div>
                )}
                <div className={styles.info}>
                  <span className={styles.name}>{g.name}</span>
                  {g.year && <span className={styles.year}>{g.year}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
