import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useMisJugadoresQuery,
  useTurnoceroJugadoresQuery,
  useBggUsernamesMapQuery,
} from "../../queries/bgWatch";
import Avatar from "../../components/shared/Avatar";
import useSearchTerm from "../../hooks/useSearchTerm";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import DiceLoader from "../../components/shared/DiceLoader";
import styles from "./BgWatchProfile.module.css";

const EMPTY_ITEMS = [];

/**
 * Selector de jugador al "+ Agregar jugador" en una partida. Dos modos:
 *   - "compañeros" (default): compañeros de tus partidas pasadas (derivados de
 *     BggPlay) paginados, con búsqueda e infinite scroll, igual que ubicaciones.
 *     Además ofrece "Usar «…»" para agregar un nombre nuevo a mano.
 *   - "turnocero": busca usuarios de TurnoCero (amigos primero) para vincularlos.
 *     Si tienen BGG conectado se completa player.username = su bggUsername (el
 *     userMap los muestra linkeados); si no, se agregan solo por nombre.
 *
 * Props:
 *   bggUsername — dueño de la lista de compañeros.
 *   existing — jugadores ya agregados [{ name, username }] (para no repetir).
 *   onPick({ name, username }) — agrega el jugador elegido.
 *   onCancel() — cierra el selector sin agregar.
 */
export default function PlayerPicker({
  bggUsername,
  existing,
  onPick,
  onCancel,
}) {
  const { t } = useTranslation("bgwatch");
  const coPlayerMeta = (p) => {
    const parts = [];
    if (p.numPlays > 0) {
      parts.push(t("playerPicker.metaPlays", { count: p.numPlays }));
    }
    if (p.lastPlayedDate) {
      parts.push(t("playerPicker.metaLast", { date: p.lastPlayedDate }));
    }
    return parts.join(" · ");
  };
  const [mode, setMode] = useState("coplayers");
  const [q, setQ] = useState("");

  // Debounce + umbral mínimo de 3 caracteres (como el buscador de juegos de
  // BGG): con 1-2 letras no refetchea, sigue mostrando la lista por defecto.
  const searchTerm = useSearchTerm(q);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const coplayersQuery = useMisJugadoresQuery({
    bggUsername,
    q: searchTerm,
    enabled: mode === "coplayers",
  });
  const turnoceroQuery = useTurnoceroJugadoresQuery({
    q: searchTerm,
    enabled: mode === "turnocero",
  });
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    isError: error,
    hasNextPage,
    fetchNextPage,
  } = mode === "coplayers" ? coplayersQuery : turnoceroQuery;
  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items || []) ?? EMPTY_ITEMS,
    [data],
  );

  // Mapa bggUsernameLower → usuario de TurnoCero, para mostrarle el avatar a los
  // compañeros que además son miembros (vinculados por su BGG username).
  const coplayerUsernames = useMemo(
    () =>
      mode === "coplayers"
        ? items
            .map((p) => (p.username || "").trim().toLowerCase())
            .filter(Boolean)
        : [],
    [items, mode],
  );
  const { data: userMap = {} } = useBggUsernamesMapQuery(coplayerUsernames);

  const onLoadMore = () => {
    if (!loadingMore && hasNextPage) fetchNextPage();
  };

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    root: listRef,
    enabled: hasNextPage && !loading && !loadingMore,
  });

  // Al elegir un jugador el picker NO se cierra (se pueden sumar varios). Para
  // poder buscar el siguiente al toque, limpiamos el input y lo reenfocamos.
  const handlePick = useCallback(
    (player) => {
      onPick(player);
      setQ("");
      inputRef.current?.focus();
    },
    [onPick],
  );

  // Set de identidades ya agregadas para no ofrecer duplicados.
  const existingUsernames = new Set(
    (existing || [])
      .map((p) => (p.username || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const existingNames = new Set(
    (existing || [])
      .filter((p) => !p.username)
      .map((p) => (p.name || "").trim().toLowerCase())
      .filter(Boolean),
  );

  const term = q.trim();
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase();

  const visibleCoPlayers = items.filter((p) => {
    if (mode !== "coplayers") return true;
    if (p.username) return !existingUsernames.has(norm(p.username));
    return !existingNames.has(norm(p.name));
  });
  const visibleTurnocero = items.filter((u) => {
    if (mode !== "turnocero") return true;
    return !(u.bggUsername && existingUsernames.has(norm(u.bggUsername)));
  });
  const visible = mode === "coplayers" ? visibleCoPlayers : visibleTurnocero;

  const exactInList =
    mode === "coplayers" &&
    visibleCoPlayers.some((p) => norm(p.name) === norm(term));
  const showCreate = mode === "coplayers" && term && !exactInList;

  return (
    <div className={styles.modalSection}>
      <div className={styles.playerPickerHead}>
        <input
          ref={inputRef}
          type="text"
          className={styles.modalInput}
          placeholder={
            mode === "coplayers"
              ? t("playerPicker.searchCoplayersPlaceholder")
              : t("playerPicker.searchTurnoceroPlaceholder")
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label={t("playerPicker.searchAria")}
        />
        <button
          type="button"
          className={styles.playerPickerCancel}
          onClick={onCancel}
          aria-label={t("playerPicker.cancel")}
        >
          ✕
        </button>
      </div>

      {(visible.length > 0 || showCreate) && (
        <ul className={styles.gameSearchList} ref={listRef}>
          {showCreate && (
            <li>
              <button
                type="button"
                className={styles.locationCreateBtn}
                onClick={() => handlePick({ name: term, username: "" })}
              >
                <span className={styles.gameSearchThumbFallback}>＋</span>
                <span className={styles.gameSearchInfo}>
                  {t("playerPicker.useTerm", { term })}
                </span>
              </button>
            </li>
          )}

          {mode === "coplayers" &&
            visibleCoPlayers.map((p) => {
              const meta = coPlayerMeta(p);
              const tcUser = p.username ? userMap[norm(p.username)] : null;
              // Precedencia: avatar curado (overlay, editado en "Jugadores") →
              // miembro de TurnoCero vinculado por BGG → iniciales (mismo
              // <Avatar> que el resto, con color por nombre).
              const avatarUser = p.avatar?.url
                ? {
                    _id: p.key || `n:${p.name}`,
                    displayName: p.name,
                    username: p.username,
                    avatar: p.avatar,
                  }
                : tcUser || {
                    _id: p.key || `n:${p.name}`,
                    displayName: p.name,
                    username: p.username,
                  };
              return (
                <li key={p.username ? `u:${p.username}` : `n:${p.name}`}>
                  <button
                    type="button"
                    className={styles.gameSearchItem}
                    onClick={() =>
                      handlePick({ name: p.name, username: p.username })
                    }
                  >
                    <Avatar user={avatarUser} size="xs" />
                    <div className={styles.gameSearchInfo}>
                      <span className={styles.gameSearchName}>
                        {p.name}
                        {p.username && (
                          <span className={styles.coPlayerHandle}>
                            {" "}
                            @{p.username}
                          </span>
                        )}
                      </span>
                      {meta && (
                        <span className={styles.gameSearchMeta}>{meta}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}

          {mode === "turnocero" &&
            visibleTurnocero.map((u) => {
              const name = u.displayName || u.username;
              return (
                <li key={u._id}>
                  <button
                    type="button"
                    className={styles.gameSearchItem}
                    onClick={() =>
                      handlePick({ name, username: u.bggUsername || "" })
                    }
                  >
                    <Avatar user={u} size="xs" />
                    <div className={styles.gameSearchInfo}>
                      <span className={styles.gameSearchName}>
                        {name}
                        {u.isFriend && (
                          <span className={styles.playerTagFriend}>
                            {t("playerPicker.tagFriend")}
                          </span>
                        )}
                        {!u.bggUsername && (
                          <span className={styles.playerTagNoBgg}>
                            {t("playerPicker.tagNoBgg")}
                          </span>
                        )}
                      </span>
                      <span className={styles.gameSearchMeta}>
                        {t("playerPicker.handle", { username: u.username })}
                        {u.bggUsername
                          ? t("playerPicker.bggMeta", { username: u.bggUsername })
                          : ""}
                      </span>
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
                  ? t("playerPicker.loadingMore")
                  : t("playerPicker.loadMore")}
              </button>
            </li>
          )}
        </ul>
      )}

      {/* El loader va DEBAJO del "Usar «…»" (que vive dentro de la lista),
          para no tapar ese atajo mientras se busca. */}
      {loading && items.length === 0 && (
        <DiceLoader text={t("playerPicker.searching")} />
      )}

      <button
        type="button"
        className={styles.bggFallbackToggle}
        onClick={() => {
          setQ("");
          setMode(mode === "coplayers" ? "turnocero" : "coplayers");
        }}
      >
        {mode === "coplayers"
          ? t("playerPicker.toTurnocero")
          : t("playerPicker.backToCoplayers")}
      </button>

      {error && (
        <p className={styles.dimText}>{t("playerPicker.loadError")}</p>
      )}
    </div>
  );
}
