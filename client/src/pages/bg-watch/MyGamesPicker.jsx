import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMisJuegosQuery } from "../../queries/bgWatch";
import BggGameSearch from "../../components/shared/BggGameSearch";
import useSearchTerm from "../../hooks/useSearchTerm";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import DiceLoader from "../../components/shared/DiceLoader";
import PickerEmptyRow from "./PickerEmptyRow";
import { gameInitials } from "./Scorecard";
import styles from "./BgWatchProfile.module.css";

const EMPTY_ITEMS = [];

/**
 * Selector de juego al cargar una partida. Sirve la lista propia del usuario
 * (ludoteca ∪ juegos jugados, ordenada por más recientemente jugado) desde el
 * endpoint paginado, con búsqueda server-side e infinite scroll. Si el juego
 * no está, togglea a la búsqueda online en BGG.
 *
 * Props:
 *   bggUsername — usuario dueño de la lista.
 *   onPick({ id, name, thumbnail, image, year, numPlays }) — misma shape que
 *   BggGameSearch + numPlays (sólo acá: marca que el juego es de la colección).
 */
export default function MyGamesPicker({ bggUsername, onPick }) {
  const { t } = useTranslation("bgwatch");
  const [q, setQ] = useState("");
  const [bggMode, setBggMode] = useState(!bggUsername);

  // Debounce + umbral mínimo de 3 caracteres (como el buscador de juegos de
  // BGG): con 1-2 letras no refetchea, sigue mostrando la lista por defecto.
  const searchTerm = useSearchTerm(q);
  const listRef = useRef(null);

  useEffect(() => {
    if (!bggUsername) setBggMode(true);
  }, [bggUsername]);

  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    isError: error,
    hasNextPage,
    fetchNextPage,
  } = useMisJuegosQuery({ bggUsername, q: searchTerm, enabled: !!bggUsername });
  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items || []) ?? EMPTY_ITEMS,
    [data],
  );

  const onLoadMore = () => {
    if (!loadingMore && hasNextPage) fetchNextPage();
  };

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    root: listRef,
    enabled: !bggMode && hasNextPage && !loading && !loadingMore,
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
            {t("myGamesPicker.backToMyGames")}
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
        placeholder={t("myGamesPicker.filterPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t("myGamesPicker.filterAria")}
      />

      {loading && items.length === 0 && (
        <DiceLoader text={t("myGamesPicker.searching")} />
      )}

      {/* Estado vacío como una sola fila compacta (mismo alto que el loader),
          tanto filtrando sin resultados como con la lista vacía de arranque.
          El CTA a BGG ya vive en el botón de abajo. */}
      {isEmpty && (
        <PickerEmptyRow>
          {q.trim()
            ? t("myGamesPicker.noMatch", { term: q.trim() })
            : t("myGamesPicker.emptyList")}
        </PickerEmptyRow>
      )}

      {items.length > 0 && (
        <div className={styles.gameList} ref={listRef}>
          {items.map((g) => {
            // High-res primero (`image`); el thumb se ve nítido al reducirse.
            const src = g.image || g.thumbnail;
            return (
              <button
                key={g.id}
                type="button"
                className={styles.gameRow}
                onClick={() =>
                  onPick({
                    id: g.id,
                    name: g.name,
                    thumbnail: g.thumbnail,
                    image: g.image,
                    year: g.year,
                    numPlays: g.numPlays,
                  })
                }
              >
                <div className={styles.gameRowThumb}>
                  {src ? (
                    <img src={src} alt={g.name} loading="lazy" />
                  ) : (
                    <span className={styles.gameRowTwoLetter}>
                      {gameInitials(g.name)}
                    </span>
                  )}
                </div>
                <div className={styles.gameRowBody}>
                  <div className={styles.gameRowName}>{g.name}</div>
                  {g.year && <div className={styles.gameRowMeta}>{g.year}</div>}
                </div>
                <span
                  className={`${styles.gameRowBadge} ${g.numPlays > 0 ? styles.gameRowBadgePlays : styles.gameRowBadgeNew}`}
                >
                  {g.numPlays > 0
                    ? t("myGamesPicker.playsTimes", { n: g.numPlays })
                    : t("myGamesPicker.new")}
                </span>
              </button>
            );
          })}
          {hasNextPage && (
            <div className={styles.gameRowMore} ref={sentinelRef}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? t("myGamesPicker.loadingMore")
                  : t("myGamesPicker.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.bggFallbackToggle}
        onClick={() => setBggMode(true)}
      >
        {t("myGamesPicker.bggFallback")}
      </button>
      {error && (
        <p className={styles.dimText}>{t("myGamesPicker.loadError")}</p>
      )}
    </div>
  );
}
