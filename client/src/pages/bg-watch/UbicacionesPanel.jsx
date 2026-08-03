import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUbicacionesQuery } from "../../queries/bgWatch";
import EmptyState from "../../components/shared/EmptyState";
import useSearchTerm from "../../hooks/useSearchTerm";
import Pagination from "./Pagination";
import SearchRowSkeleton from "./SearchRowSkeleton";
import { locationMeta } from "./LocationEditModals";
import styles from "./BgWatchProfile.module.css";

// Icono de pin (las ubicaciones no tienen avatar como los jugadores).
function PinIcon() {
  return (
    <svg
      className={styles.ubicacionPin}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/**
 * Pestaña "Ubicaciones": lista las ubicaciones de las partidas del dueño. La
 * curación (renombrar / fusionar) vive dentro de la vista de detalle. Montada
 * solo para dueño/admin (gate en BgWatchProfile).
 */
export default function UbicacionesPanel({ bggUsername, onTotalChange }) {
  const { t } = useTranslation("bgwatch");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const navigate = useNavigate();
  const searchTerm = useSearchTerm(q);

  const openDetail = (row) =>
    navigate(
      `/bg-watch/${encodeURIComponent(bggUsername)}/ubicacion/${encodeURIComponent(
        row.key,
      )}`,
    );

  const {
    data,
    isPending: loading,
    isError: error,
  } = useUbicacionesQuery({ bggUsername, page, q: searchTerm });
  const items = data?.items || [];
  const pages = data?.pages || 1;
  const total = data?.total || 0;

  // Reset a página 1 al cambiar la búsqueda.
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  // Reportar el total al padre solo sin búsqueda activa, para que el badge de
  // la tab refleje el total real (no el filtrado).
  useEffect(() => {
    if (data && !searchTerm) onTotalChange?.(data.total || 0);
  }, [data, searchTerm, onTotalChange]);

  const isEmpty = !loading && !error && items.length === 0;

  return (
    <div className={styles.modalSection}>
      <p className={styles.sectionHelp}>{t("ubicaciones.help")}</p>

      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder={t("ubicaciones.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label={t("ubicaciones.searchAria")}
        />
      </div>

      {loading && items.length === 0 && <SearchRowSkeleton rows={5} />}

      {error && (
        <p className={styles.dimText}>{t("ubicaciones.loadError")}</p>
      )}

      {isEmpty && (
        <EmptyState
          variant="filtered"
          compact
          title={
            q ? t("ubicaciones.emptyFilteredTitle") : t("ubicaciones.emptyTitle")
          }
          text={
            q ? t("ubicaciones.emptyFilteredText") : t("ubicaciones.emptyText")
          }
        />
      )}

      {items.length > 0 && (
        <ul className={styles.gameSearchList}>
          {items.map((row) => {
            const meta = locationMeta(row);
            return (
              <li key={row.key} className={styles.jugadorRow}>
                <button
                  type="button"
                  className={styles.jugadorRowMain}
                  onClick={() => openDetail(row)}
                  title={t("ubicaciones.openDetailTitle")}
                >
                  <PinIcon />
                  <div className={styles.gameSearchInfo}>
                    <span className={styles.gameSearchName}>
                      {row.name || t("ubicaciones.nameFallback")}
                    </span>
                    {meta && (
                      <span className={styles.gameSearchMeta}>{meta}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <Pagination
          page={page}
          totalPages={pages}
          onPage={(p) => setPage(p)}
        />
      )}

      {total > 0 && (
        <p className={styles.dimText}>
          {t("ubicaciones.total", { count: total })}
        </p>
      )}
    </div>
  );
}
