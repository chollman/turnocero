import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EventoLudotecaPicker from "./EventoLudotecaPicker";
import styles from "./EventoLudoteca.module.css";

/**
 * Pestaña "Ludoteca" dentro del detalle del evento.
 *
 * Permisos:
 *   - Read: cualquiera que pueda ver el evento.
 *   - Add: confirmed registrants + author + site admin (server hace el check).
 *   - Delete/Edit: solo el owner del item o un admin (server hace el check).
 *
 * Se suscribe a actualizaciones via las callbacks del hook `useEventoSocket`
 * en EventoDetail (lifted) — este componente sólo recibe `items` y un setter.
 *
 * Si `items` viene null, hace su propio fetch al mount.
 */
export default function EventoLudoteca({
  eventoId,
  evento,
  items: itemsProp,
  setItems: setItemsProp,
  canAdd = false,
}) {
  const { user } = useAuth();
  const { addToast } = useNotifications();

  // Si el padre no maneja el state (uso standalone / tests), lo hacemos local.
  const [localItems, setLocalItems] = useState(itemsProp ?? null);
  useEffect(() => {
    if (itemsProp !== undefined) setLocalItems(itemsProp);
  }, [itemsProp]);

  const items = localItems;
  const setItems = (updater) => {
    setLocalItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setItemsProp?.(next);
      return next;
    });
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch inicial si el padre no nos pasó items.
  useEffect(() => {
    if (itemsProp !== undefined) return; // managed by parent
    let cancelled = false;
    axios
      .get(API.eventos.LUDOTECA(eventoId))
      .then(({ data }) => {
        if (cancelled) return;
        setLocalItems(data.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setLocalItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventoId, itemsProp]);

  const handleAdded = (newItem) => {
    // Dedupe por _id: si el socket event ya entregó el item antes de que el
    // POST resuelva (race común — ver [[feedback-optimistic-vs-socket]]),
    // este append duplicaría. Mismo patrón que `onLudotecaChanged` en el parent.
    setItems((prev) => {
      const list = prev || [];
      if (list.some((it) => it._id === newItem._id)) return list;
      return [...list, newItem];
    });
  };

  const handleDelete = async (item) => {
    if (deletingId) return;
    const ok = window.confirm(`¿Quitar "${item.gameName}" de la ludoteca?`);
    if (!ok) return;
    setDeletingId(item._id);
    try {
      await axios.delete(API.eventos.LUDOTECA_ITEM(eventoId, item._id));
      setItems((prev) => (prev || []).filter((it) => it._id !== item._id));
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: err.response?.data?.message || "No pudimos quitar el juego.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (item) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (String(evento?.author?._id || evento?.author) === String(user._id))
      return true;
    return String(item.addedBy?._id || item.addedBy) === String(user._id);
  };

  if (items == null) {
    return <div className={styles.dim}>Cargando ludoteca…</div>;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>Ludoteca del evento</h3>
          <p className={styles.subtitle}>
            {items.length === 0
              ? "Todavía no hay juegos. Agregá los que vas a llevar."
              : `${items.length} ${items.length === 1 ? "juego" : "juegos"} aportado${items.length === 1 ? "" : "s"} por la comunidad.`}
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setPickerOpen(true)}
          >
            + Agregar juego
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDot}>◆</span>
          <p className={styles.emptyText}>
            {canAdd
              ? "Sé el primero en sumar un juego a la ludoteca."
              : "Sólo los inscriptos confirmados pueden agregar juegos."}
          </p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {items.map((item) => {
            const bggUrl = item.bggGameId
              ? `https://boardgamegeek.com/boardgame/${item.bggGameId}`
              : null;
            return (
              <li key={item._id} className={styles.card}>
                {bggUrl ? (
                  <a
                    href={bggUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.thumbLink}
                    aria-label={`Ver ${item.gameName} en BoardGameGeek`}
                  >
                    {item.image || item.thumbnail ? (
                      <img
                        src={item.image || item.thumbnail}
                        alt={item.gameName}
                        className={styles.thumb}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.thumbFallback} aria-hidden="true">
                        🎲
                      </div>
                    )}
                  </a>
                ) : item.image || item.thumbnail ? (
                  <img
                    src={item.image || item.thumbnail}
                    alt={item.gameName}
                    className={styles.thumb}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.thumbFallback} aria-hidden="true">
                    🎲
                  </div>
                )}
                <div className={styles.body}>
                  <div className={styles.name}>
                    {bggUrl ? (
                      <a
                        href={bggUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.nameLink}
                      >
                        {item.gameName}
                        <span className={styles.bggArrow} aria-hidden="true">
                          ↗
                        </span>
                      </a>
                    ) : (
                      item.gameName
                    )}
                  </div>
                  {item.year && (
                    <div className={styles.year}>
                      {item.year}
                      {item.minPlayers && item.maxPlayers && (
                        <>
                          {" · "}
                          {item.minPlayers === item.maxPlayers
                            ? `${item.minPlayers} jug.`
                            : `${item.minPlayers}-${item.maxPlayers} jug.`}
                        </>
                      )}
                    </div>
                  )}
                  {item.notes && (
                    <div className={styles.notes}>“{item.notes}”</div>
                  )}
                  {item.addedBy?._id ? (
                    <Link
                      to={`/usuarios/${item.addedBy._id}`}
                      className={styles.addedBy}
                    >
                      <Avatar user={item.addedBy} size="xs" />
                      <span className={styles.addedByName}>
                        {item.addedBy.displayName ||
                          item.addedBy.username ||
                          "?"}
                      </span>
                    </Link>
                  ) : (
                    <div className={styles.addedBy}>
                      <Avatar user={item.addedBy} size="xs" />
                      <span className={styles.addedByName}>?</span>
                    </div>
                  )}
                </div>
                {canDelete(item) && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item._id}
                    aria-label={`Quitar ${item.gameName}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <EventoLudotecaPicker
        eventoId={eventoId}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdded={handleAdded}
        existingItems={items || []}
      />
    </div>
  );
}
