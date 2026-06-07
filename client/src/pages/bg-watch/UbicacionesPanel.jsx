import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
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
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");

  const navigate = useNavigate();
  const searchTerm = useSearchTerm(q);
  const reqIdRef = useRef(0);

  const openDetail = (row) =>
    navigate(
      `/bg-watch/${encodeURIComponent(bggUsername)}/ubicacion/${encodeURIComponent(
        row.key,
      )}`,
    );

  const fetchPage = useCallback(
    (pageToLoad) => {
      const myId = ++reqIdRef.current;
      setLoading(true);
      setError(false);
      axios
        .get(API.bgg.UBICACIONES(bggUsername), {
          params: { page: pageToLoad, q: searchTerm || undefined },
        })
        .then(({ data }) => {
          if (myId !== reqIdRef.current) return;
          setItems(data.items || []);
          setPage(data.page || pageToLoad);
          setPages(data.pages || 1);
          setTotal(data.total || 0);
          // Reportar el total al padre solo sin búsqueda activa, para que el
          // badge de la tab refleje el total real (no el filtrado).
          if (!searchTerm && onTotalChange) onTotalChange(data.total || 0);
        })
        .catch(() => {
          if (myId === reqIdRef.current) setError(true);
        })
        .finally(() => {
          if (myId === reqIdRef.current) setLoading(false);
        });
    },
    [bggUsername, searchTerm, onTotalChange],
  );

  useEffect(() => {
    fetchPage(1);
  }, [searchTerm, fetchPage]);

  const isEmpty = !loading && !error && items.length === 0;

  return (
    <div className={styles.modalSection}>
      <p className={styles.sectionHelp}>
        Estas son las ubicaciones de tus partidas. Tocá una para ver su detalle
        y editarla (corregir el nombre o fusionar duplicadas).
      </p>

      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder="Buscar ubicación…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label="Buscar ubicación"
        />
      </div>

      {loading && items.length === 0 && <SearchRowSkeleton rows={5} />}

      {error && (
        <p className={styles.dimText}>
          No se pudo cargar la lista de ubicaciones.
        </p>
      )}

      {isEmpty && (
        <EmptyState
          variant="filtered"
          compact
          title={q ? "Sin coincidencias" : "Sin ubicaciones aún"}
          text={
            q
              ? "Ninguna ubicación coincide con tu búsqueda."
              : "Cuando cargues partidas con una ubicación van a aparecer acá."
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
                  title="Ver partidas y estadísticas de esta ubicación"
                >
                  <PinIcon />
                  <div className={styles.gameSearchInfo}>
                    <span className={styles.gameSearchName}>
                      {row.name || "Sin nombre"}
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
          onPage={(p) => fetchPage(p)}
        />
      )}

      {total > 0 && (
        <p className={styles.dimText}>
          {total} ubicaci{total === 1 ? "ón" : "ones"}
        </p>
      )}
    </div>
  );
}
