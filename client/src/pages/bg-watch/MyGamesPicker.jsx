import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import BggGameSearch from "../../components/shared/BggGameSearch";
import EmptyState from "../../components/shared/EmptyState";
import useSearchTerm from "../../hooks/useSearchTerm";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import SearchRowSkeleton from "./SearchRowSkeleton";
import styles from "./BgWatchProfile.module.css";

function metaLine(g) {
  const parts = [];
  if (g.numPlays > 0) {
    parts.push(`${g.numPlays} partida${g.numPlays === 1 ? "" : "s"}`);
  } else if (g.owned) {
    parts.push("En tu colección");
  }
  if (g.year) parts.push(String(g.year));
  return parts.join(" · ");
}

/**
 * Selector de juego al cargar una partida. Sirve la lista propia del usuario
 * (ludoteca ∪ juegos jugados, ordenada por más recientemente jugado) desde el
 * endpoint paginado, con búsqueda server-side e infinite scroll. Si el juego
 * no está, togglea a la búsqueda online en BGG.
 *
 * Props:
 *   bggUsername — usuario dueño de la lista.
 *   onPick({ id, name, thumbnail, image, year }) — misma shape que BggGameSearch.
 */
export default function MyGamesPicker({ bggUsername, onPick }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [bggMode, setBggMode] = useState(!bggUsername);

  // Debounce + umbral mínimo de 3 caracteres (como el buscador de juegos de
  // BGG): con 1-2 letras no refetchea, sigue mostrando la lista por defecto.
  const searchTerm = useSearchTerm(q);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  // Trae una página. `append` distingue "cargar más" de un reset. Sólo aplica
  // estado la request más reciente (reqId) para que un cambio de búsqueda no
  // se pise con un "load more" en vuelo.
  const fetchPage = useCallback(
    (pageToLoad, append) => {
      if (!bggUsername) return;
      const myId = ++reqIdRef.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(false);
      axios
        .get(API.bgg.MIS_JUEGOS(bggUsername), {
          params: { page: pageToLoad, q: searchTerm || undefined },
          signal: ac.signal,
        })
        .then(({ data }) => {
          if (myId !== reqIdRef.current) return;
          setItems((prev) =>
            append ? [...prev, ...(data.items || [])] : data.items || [],
          );
          setPage(data.page || pageToLoad);
          setPages(data.pages || 1);
        })
        .catch((err) => {
          if (myId !== reqIdRef.current || axios.isCancel(err)) return;
          setError(true);
        })
        .finally(() => {
          if (myId !== reqIdRef.current) return;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [bggUsername, searchTerm],
  );

  // Reset + primera página cuando cambia el usuario o el término de búsqueda.
  useEffect(() => {
    if (!bggUsername) {
      setBggMode(true);
      return;
    }
    setItems([]);
    setPage(1);
    setPages(1);
    fetchPage(1, false);
  }, [bggUsername, searchTerm, fetchPage]);

  const onLoadMore = useCallback(() => {
    fetchPage(page + 1, true);
  }, [fetchPage, page]);

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    root: listRef,
    enabled: !bggMode && page < pages && !loading && !loadingMore,
  });

  if (bggMode) {
    return (
      <div className={styles.modalSection}>
        <BggGameSearch onPick={onPick} />
        {bggUsername && (
          <button
            type="button"
            className={styles.bggFallbackToggle}
            onClick={() => setBggMode(false)}
          >
            ← Volver a mis juegos
          </button>
        )}
      </div>
    );
  }

  const isEmpty = !loading && items.length === 0;

  return (
    <div className={styles.modalSection}>
      <input
        type="text"
        className={styles.modalInput}
        placeholder="Filtrá tus juegos…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filtrar mis juegos"
      />

      {loading && items.length === 0 && <SearchRowSkeleton rows={4} />}

      {isEmpty && (
        <EmptyState
          variant="filtered"
          compact
          title={q.trim() ? "Sin coincidencias" : "Tu lista está vacía"}
          text={
            q.trim()
              ? "Ningún juego coincide con el filtro."
              : "Buscá un juego en BGG abajo para agregarlo."
          }
        />
      )}

      {items.length > 0 && (
        <ul className={styles.gameSearchList} ref={listRef}>
          {items.map((g) => {
            const meta = metaLine(g);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className={styles.gameSearchItem}
                  onClick={() =>
                    onPick({
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
                      className={styles.gameSearchThumb}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.gameSearchThumbFallback}>🎲</div>
                  )}
                  <div className={styles.gameSearchInfo}>
                    <span className={styles.gameSearchName}>{g.name}</span>
                    {meta && (
                      <span className={styles.gameSearchMeta}>{meta}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {page < pages && (
            <li ref={sentinelRef}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Cargando más…" : "Ver más"}
              </button>
            </li>
          )}
        </ul>
      )}

      <button
        type="button"
        className={styles.bggFallbackToggle}
        onClick={() => setBggMode(true)}
      >
        ¿No lo encontrás? Buscar en BGG
      </button>
      {error && (
        <p className={styles.dimText}>
          No se pudo cargar tu lista — probá buscando en BGG.
        </p>
      )}
    </div>
  );
}
