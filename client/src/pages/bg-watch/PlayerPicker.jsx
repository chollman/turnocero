import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import useSearchTerm from "../../hooks/useSearchTerm";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import SearchRowSkeleton from "./SearchRowSkeleton";
import styles from "./BgWatchProfile.module.css";

function coPlayerMeta(p) {
  const parts = [];
  if (p.numPlays > 0) {
    parts.push(`${p.numPlays} partida${p.numPlays === 1 ? "" : "s"}`);
  }
  if (p.lastPlayedDate) parts.push(`última: ${p.lastPlayedDate}`);
  return parts.join(" · ");
}

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
  const [mode, setMode] = useState("coplayers");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");

  // Debounce + umbral mínimo de 3 caracteres (como el buscador de juegos de
  // BGG): con 1-2 letras no refetchea, sigue mostrando la lista por defecto.
  const searchTerm = useSearchTerm(q);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  // Mapa bggUsernameLower → usuario de TurnoCero, para mostrarle el avatar a los
  // compañeros que además son miembros (vinculados por su BGG username). Se va
  // acumulando a medida que aparecen nuevos usernames (paginación / búsqueda);
  // requestedRef evita refetchear los ya consultados.
  const [userMap, setUserMap] = useState({});
  const requestedRef = useRef(new Set());

  useEffect(() => {
    if (mode !== "coplayers") return undefined;
    const toFetch = [];
    for (const p of items) {
      const u = (p.username || "").trim().toLowerCase();
      if (u && !requestedRef.current.has(u)) {
        requestedRef.current.add(u);
        toFetch.push(u);
      }
    }
    if (toFetch.length === 0) return undefined;
    let cancelled = false;
    const chunks = [];
    for (let i = 0; i < toFetch.length; i += 50) {
      chunks.push(toFetch.slice(i, i + 50));
    }
    Promise.all(
      chunks.map((c) =>
        axios
          .post(API.users.BY_BGG_USERNAMES, { usernames: c })
          .then((r) => r.data)
          .catch(() => []),
      ),
    ).then((results) => {
      if (cancelled) return;
      const merged = {};
      for (const arr of results) {
        if (!Array.isArray(arr)) continue;
        for (const u of arr) {
          if (u.bggUsername) merged[u.bggUsername.toLowerCase()] = u;
        }
      }
      if (Object.keys(merged).length) {
        setUserMap((prev) => ({ ...prev, ...merged }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, mode]);

  const fetchPage = useCallback(
    (pageToLoad, append) => {
      if (mode === "coplayers" && !bggUsername) return;
      const myId = ++reqIdRef.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(false);
      const url =
        mode === "coplayers"
          ? API.bgg.MIS_JUGADORES(bggUsername)
          : API.users.JUGADORES;
      axios
        .get(url, {
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
    [mode, bggUsername, searchTerm],
  );

  useEffect(() => {
    setItems([]);
    setPage(1);
    setPages(1);
    fetchPage(1, false);
  }, [mode, searchTerm, fetchPage]);

  const onLoadMore = useCallback(() => {
    fetchPage(page + 1, true);
  }, [fetchPage, page]);

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    root: listRef,
    enabled: page < pages && !loading && !loadingMore,
  });

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
  const isEmpty = !loading && visible.length === 0;

  return (
    <div className={styles.modalSection}>
      <div className={styles.playerPickerHead}>
        <input
          type="text"
          className={styles.modalInput}
          placeholder={
            mode === "coplayers"
              ? "Buscá o escribí un jugador…"
              : "Buscá un usuario de TurnoCero…"
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          aria-label="Buscar jugador"
          autoFocus
        />
        <button
          type="button"
          className={styles.playerPickerCancel}
          onClick={onCancel}
          aria-label="Cancelar"
        >
          ✕
        </button>
      </div>

      {loading && items.length === 0 && <SearchRowSkeleton rows={4} />}

      {isEmpty && (
        <EmptyState
          variant="filtered"
          compact
          title={
            mode === "coplayers" && !term
              ? "Sin compañeros aún"
              : "Sin coincidencias"
          }
          text={
            mode === "coplayers"
              ? term
                ? "Ningún compañero coincide. Usá el botón de abajo para agregarlo."
                : "Escribí un nombre o buscá en TurnoCero."
              : "Ningún usuario coincide."
          }
        />
      )}

      {(visible.length > 0 || showCreate) && (
        <ul className={styles.gameSearchList} ref={listRef}>
          {showCreate && (
            <li>
              <button
                type="button"
                className={styles.locationCreateBtn}
                onClick={() => onPick({ name: term, username: "" })}
              >
                <span className={styles.gameSearchThumbFallback}>＋</span>
                <span className={styles.gameSearchInfo}>Usar «{term}»</span>
              </button>
            </li>
          )}

          {mode === "coplayers" &&
            visibleCoPlayers.map((p) => {
              const meta = coPlayerMeta(p);
              const tcUser = p.username ? userMap[norm(p.username)] : null;
              // Precedencia: avatar curado (overlay, editado en "Jugadores") →
              // miembro de TurnoCero vinculado por BGG → 👤.
              const avatarUser = p.avatar?.url
                ? {
                    _id: p.key || `n:${p.name}`,
                    displayName: p.name,
                    username: p.username,
                    avatar: p.avatar,
                  }
                : tcUser;
              return (
                <li key={p.username ? `u:${p.username}` : `n:${p.name}`}>
                  <button
                    type="button"
                    className={styles.gameSearchItem}
                    onClick={() =>
                      onPick({ name: p.name, username: p.username })
                    }
                  >
                    {avatarUser ? (
                      <Avatar user={avatarUser} size="xs" />
                    ) : (
                      <span className={styles.gameSearchThumbFallback}>👤</span>
                    )}
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
                      onPick({ name, username: u.bggUsername || "" })
                    }
                  >
                    <Avatar user={u} size="xs" />
                    <div className={styles.gameSearchInfo}>
                      <span className={styles.gameSearchName}>
                        {name}
                        {u.isFriend && (
                          <span className={styles.playerTagFriend}>amigo</span>
                        )}
                        {!u.bggUsername && (
                          <span className={styles.playerTagNoBgg}>sin BGG</span>
                        )}
                      </span>
                      <span className={styles.gameSearchMeta}>
                        @{u.username}
                        {u.bggUsername ? ` · BGG: ${u.bggUsername}` : ""}
                      </span>
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
        onClick={() => {
          setQ("");
          setMode(mode === "coplayers" ? "turnocero" : "coplayers");
        }}
      >
        {mode === "coplayers"
          ? "Buscar un usuario de TurnoCero →"
          : "← Volver a mis compañeros"}
      </button>

      {error && <p className={styles.dimText}>No se pudo cargar la lista.</p>}
    </div>
  );
}
