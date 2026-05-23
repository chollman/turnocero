import { useEffect, useRef, useState } from "react";
import axios from "axios";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { API } from "../../api/endpoints";
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
  placeholder = "Buscá un juego en BGG (≥3 caracteres)…",
  autoFocus = true,
  minChars = 3,
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(q, 300);
  const reqId = useRef(0);

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
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        aria-label="Buscar juego en BoardGameGeek"
      />
      {loading && <p className={styles.dim}>Buscando…</p>}
      {showEmpty && <p className={styles.dim}>Sin resultados.</p>}
      {results.length > 0 && (
        <ul className={styles.list} role="listbox">
          {results.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() =>
                  onPick?.({
                    id: g.id,
                    name: g.name,
                    thumbnail: g.thumbnail,
                    image: g.image,
                    year: g.year,
                  })
                }
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
