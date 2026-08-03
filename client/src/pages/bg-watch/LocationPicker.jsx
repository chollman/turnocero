import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMisUbicacionesQuery } from "../../queries/bgWatch";
import useSearchTerm from "../../hooks/useSearchTerm";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import useClickOutside from "../../hooks/useClickOutside";
import EmptyState from "../../components/shared/EmptyState";
import DiceLoader from "../../components/shared/DiceLoader";
import styles from "./BgWatchProfile.module.css";

const EMPTY_ITEMS = [];

/**
 * Selector de ubicación al cargar/editar una partida. A diferencia del selector
 * de juego (lista siempre inline), la lista de ubicaciones se DESPLIEGA como un
 * dropdown al cliquear el input. Sirve las ubicaciones que el usuario ya usó en
 * sus partidas (derivadas de BggPlay) desde el endpoint paginado, con búsqueda
 * server-side e infinite scroll. El input doble-funciona como campo de alta: si
 * lo tipeado no coincide con ninguna ubicación de la lista, ofrece "Usar «…»"
 * para elegir una ubicación nueva (que aparecerá en la lista tras guardar).
 *
 * Props:
 *   bggUsername — usuario dueño de la lista (sin él → input de texto libre).
 *   value — ubicación actualmente elegida (string).
 *   onPick(locationString) — callback al elegir/crear una ubicación.
 */
export default function LocationPicker({ bggUsername, value, onPick }) {
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
  const [open, setOpen] = useState(false);

  // Debounce + umbral mínimo de 3 caracteres (como el buscador de juegos de
  // BGG): con 1-2 letras no refetchea, sigue mostrando la lista por defecto.
  const searchTerm = useSearchTerm(q);
  const fieldRef = useRef(null);
  const listRef = useRef(null);

  // Sólo trae datos mientras el dropdown está abierto (evita un fetch inútil
  // al montar con el selector cerrado).
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
    enabled: !!bggUsername && open,
  });
  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items || []) ?? EMPTY_ITEMS,
    [data],
  );

  // Cerrar al clickear fuera del campo.
  useClickOutside(fieldRef, () => setOpen(false), open);

  const onLoadMore = () => {
    if (!loadingMore && hasNextPage) fetchNextPage();
  };

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    root: listRef,
    enabled: open && hasNextPage && !loading && !loadingMore,
  });

  const choose = (loc) => {
    onPick(loc);
    setQ("");
    setOpen(false);
  };

  // Sin usuario BGG no podemos paginar — caemos a un input de texto libre.
  if (!bggUsername) {
    return (
      <input
        type="text"
        className={styles.modalInput}
        value={value || ""}
        onChange={(e) => onPick(e.target.value)}
        placeholder={t("locationPicker.freePlaceholder")}
        maxLength={100}
        aria-label={t("locationPicker.freeAria")}
      />
    );
  }

  const term = q.trim();
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase();
  const exactInList = items.some((it) => norm(it.name) === norm(term));
  const showCreate = term && !exactInList;
  const isEmpty = !loading && items.length === 0;

  return (
    <div className={styles.locationField} ref={fieldRef}>
      {value && (
        <p className={styles.locationSelected}>
          {t("locationPicker.selected")} <strong>{value}</strong>
        </p>
      )}
      <input
        type="text"
        className={styles.modalInput}
        placeholder={t("locationPicker.placeholder")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        maxLength={100}
        role="combobox"
        aria-expanded={open}
        aria-label={t("locationPicker.comboAria")}
      />

      {open && (
        <div className={styles.locationDropdown}>
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
                        <span className={styles.gameSearchName}>
                          {loc.name}
                        </span>
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
      )}
    </div>
  );
}
