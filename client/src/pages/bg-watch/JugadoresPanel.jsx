import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import useSearchTerm from "../../hooks/useSearchTerm";
import Pagination from "./Pagination";
import SearchRowSkeleton from "./SearchRowSkeleton";
import { rowAvatarUser, playerMeta } from "./PlayerEditModals";
import styles from "./BgWatchProfile.module.css";

/**
 * Pestaña "Jugadores": lista el roster de jugadores de las partidas del dueño.
 * La curación (editar nombre / @BGG / avatar / fusionar) vive ahora dentro de
 * la vista de detalle del jugador; acá solo se listan y se puede deshacer el
 * "sos vos". Montado solo para dueño/admin (gate en BgWatchProfile).
 */
export default function JugadoresPanel({ bggUsername, onTotalChange }) {
  const { t } = useTranslation("bgwatch");
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
      `/bg-watch/${encodeURIComponent(bggUsername)}/jugador/${encodeURIComponent(
        row.key,
      )}`,
    );

  const fetchPage = useCallback(
    (pageToLoad) => {
      const myId = ++reqIdRef.current;
      setLoading(true);
      setError(false);
      axios
        .get(API.bgg.JUGADORES(bggUsername), {
          params: { page: pageToLoad, q: searchTerm || undefined },
        })
        .then(({ data }) => {
          if (myId !== reqIdRef.current) return;
          setItems(data.items || []);
          setPage(data.page || pageToLoad);
          setPages(data.pages || 1);
          setTotal(data.total || 0);
          // Reportar el total al padre solo sin búsqueda activa, para que el
          // badge de la tab refleje el total real (no el filtrado) — igual que
          // PartidasPanel con su meta.
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

  const reload = () => fetchPage(page);

  // Marcar / desmarcar a un jugador como el propio dueño del perfil.
  const setSelf = async (row, value) => {
    try {
      await axios.post(API.bgg.JUGADOR_YO_MISMO(bggUsername), {
        rawKeys: row.rawKeys,
        value,
      });
      reload();
    } catch (e) {
      alert(e?.response?.data?.message || t("jugadores.updateError"));
    }
  };

  const isEmpty = !loading && !error && items.length === 0;

  return (
    <div className={styles.modalSection}>
      <p className={styles.sectionHelp}>{t("jugadores.help")}</p>

      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder={t("jugadores.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label={t("jugadores.searchAria")}
        />
      </div>

      {loading && items.length === 0 && <SearchRowSkeleton rows={5} />}

      {error && (
        <p className={styles.dimText}>{t("jugadores.loadError")}</p>
      )}

      {isEmpty && (
        <EmptyState
          variant="filtered"
          compact
          title={
            q ? t("jugadores.emptyFilteredTitle") : t("jugadores.emptyTitle")
          }
          text={
            q ? t("jugadores.emptyFilteredText") : t("jugadores.emptyText")
          }
        />
      )}

      {items.length > 0 && (
        <ul className={styles.gameSearchList}>
          {items.map((row) => {
            const meta = playerMeta(row);
            return (
              <li key={row.key} className={styles.jugadorRow}>
                <button
                  type="button"
                  className={styles.jugadorRowMain}
                  onClick={() => openDetail(row)}
                  title={t("jugadores.openDetailTitle")}
                >
                  <Avatar user={rowAvatarUser(row)} size="sm" />
                  <div className={styles.gameSearchInfo}>
                    <span className={styles.gameSearchName}>
                      {row.name || row.username || t("jugadores.nameFallback")}
                      {row.username && (
                        <span className={styles.coPlayerHandle}>
                          {" "}
                          @{row.username}
                        </span>
                      )}
                      {row.isLinked && (
                        <span className={styles.playerTagFriend}>
                          {t("jugadores.memberTag")}
                        </span>
                      )}
                      {row.isSelf && (
                        <span className={styles.playerTagSelf}>
                          {t("jugadores.selfTag")}
                        </span>
                      )}
                    </span>
                    {meta && (
                      <span className={styles.gameSearchMeta}>{meta}</span>
                    )}
                  </div>
                </button>
                {row.isSelf && (
                  <div className={styles.jugadorActions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setSelf(row, false)}
                      title={t("jugadores.unmarkSelfTitle")}
                    >
                      {t("jugadores.unmarkSelf")}
                    </button>
                  </div>
                )}
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
          {t("jugadores.total", { count: total })}
        </p>
      )}
    </div>
  );
}
