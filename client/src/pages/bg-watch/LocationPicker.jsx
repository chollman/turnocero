import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMisUbicacionesQuery } from "../../queries/bgWatch";
import useSearchTerm from "../../hooks/useSearchTerm";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import EmptyState from "../../components/shared/EmptyState";
import DiceLoader from "../../components/shared/DiceLoader";
import styles from "./BgWatchProfile.module.css";

const EMPTY_ITEMS = [];

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

/**
 * Picker de ubicación al "Agregar lugar" de una partida — misma estructura de
 * popover que PlayerPicker/ExpansionsPicker/VariantPicker: abrir/cerrar y
 * click-afuera los maneja el contenedor (PlayForm); acá sólo el contenido —
 * input + lista paginada (con búsqueda server-side) de las ubicaciones que el
 * usuario ya usó, con "Usar «…»" para dar de alta una nueva.
 *
 * Props:
 *   bggUsername — usuario dueño de la lista (sin él → input de texto libre).
 *   value — ubicación actualmente elegida (string, resalta el item activo).
 *   onPick(locationString) — al elegir/crear una ubicación (cierra el picker).
 *   onClose() — cierra el picker sin elegir.
 */
export default function LocationPicker({
  bggUsername,
  value,
  onPick,
  onClose,
}) {
  const { t } = useTranslation("bgwatch");
  const metaLine = (loc) => {
    const parts = [];
    if (loc.numPlays > 0) {
      parts.push(t("locationPicker.metaPlays", { count: loc.numPlays }));
    }
    if (loc.lastPlayedDate) {
      parts.push(t("locationPicker.metaLast", { date: loc.lastPlayedDate }));
    }
    return parts.join(" · ");
  };
  const [q, setQ] = useState("");

  // Debounce + umbral mínimo de 3 caracteres (como el resto de pickers).
  const searchTerm = useSearchTerm(q);
  const listRef = useRef(null);

  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    isError: error,
    hasNextPage,
    fetchNextPage,
  } = useMisUbicacionesQuery({
    bggUsername,
    q: searchTerm,
    enabled: !!bggUsername,
  });
  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items || []) ?? EMPTY_ITEMS,
    [data],
  );

  const onLoadMore = () => {
    if (!loadingMore && hasNextPage) fetchNextPage();
  };

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    root: listRef,
    enabled: hasNextPage && !loading && !loadingMore,
  });

  const choose = (loc) => {
    onPick(loc);
    onClose?.();
  };

  // Sin usuario BGG no podemos paginar — caemos a un input de texto libre,
  // con el mismo header (input + ✕) que el resto de los pickers.
  if (!bggUsername) {
    return (
      <div className={styles.modalSection}>
        <div className={styles.playerPickerHead}>
          <input
            type="text"
            className={styles.modalInput}
            value={value || ""}
            onChange={(e) => onPick(e.target.value)}
            placeholder={t("locationPicker.freePlaceholder")}
            maxLength={100}
            aria-label={t("locationPicker.freeAria")}
            autoFocus
          />
          <button
            type="button"
            className={styles.playerPickerCancel}
            onClick={onClose}
            aria-label={t("locationPicker.close")}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  const term = q.trim();
  const exactInList = items.some((it) => norm(it.name) === norm(term));
  const showCreate = term && !exactInList;
  const isEmpty = !loading && items.length === 0;

  return (
    <div className={styles.modalSection}>
      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder={t("locationPicker.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && term) {
              e.preventDefault();
              choose(term);
            }
          }}
          maxLength={100}
          aria-label={t("locationPicker.comboAria")}
          autoFocus
        />
        <button
          type="button"
          className={styles.playerPickerCancel}
          onClick={onClose}
          aria-label={t("locationPicker.close")}
        >
          ✕
        </button>
      </div>

      {isEmpty && !term && (
        <EmptyState
          variant="filtered"
          compact
          title={t("locationPicker.emptyTitle")}
          text={t("locationPicker.emptyText")}
        />
      )}

      {(items.length > 0 || showCreate) && (
        <ul className={styles.gameSearchList} ref={listRef}>
          {showCreate && (
            <li>
              <button
                type="button"
                className={styles.locationCreateBtn}
                onClick={() => choose(term)}
              >
                <span className={styles.gameSearchThumbFallback}>📍</span>
                <span className={styles.gameSearchInfo}>
                  {t("locationPicker.useTerm", { term })}
                </span>
              </button>
            </li>
          )}
          {items.map((loc) => {
            const meta = metaLine(loc);
            const active = norm(loc.name) === norm(value);
            return (
              <li key={loc.name}>
                <button
                  type="button"
                  className={`${styles.gameSearchItem} ${active ? styles.locationItemActive : ""}`}
                  onClick={() => choose(loc.name)}
                >
                  <span className={styles.gameSearchThumbFallback}>📍</span>
                  <div className={styles.gameSearchInfo}>
                    <span className={styles.gameSearchName}>{loc.name}</span>
                    {meta && (
                      <span className={styles.gameSearchMeta}>{meta}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {hasNextPage && (
            <li ref={sentinelRef}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? t("locationPicker.loadingMore")
                  : t("locationPicker.loadMore")}
              </button>
            </li>
          )}
        </ul>
      )}

      {/* El loader va DEBAJO del "Usar «…»" (dentro de la lista), para no
          tapar ese atajo mientras se busca. */}
      {loading && items.length === 0 && (
        <DiceLoader text={t("locationPicker.searching")} />
      )}

      {error && (
        <p className={styles.dimText}>{t("locationPicker.loadError")}</p>
      )}
    </div>
  );
}
