import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import Modal from "../../components/shared/Modal";
import BggGameSearch from "../../components/shared/BggGameSearch";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import styles from "./EventoLudotecaPicker.module.css";

/**
 * Modal para agregar un juego a la ludoteca del evento.
 *
 * Dos fuentes:
 *   - "Mi colección" — GET /api/bgg/coleccion/:bggUsername (solo si user
 *     tiene bggUsername seteado). Grid con filtro por nombre debounced.
 *   - "Buscar BGG" — usa el componente shared BggGameSearch.
 *
 * Al elegir un juego: pide confirmación con notes opcional, después POST al
 * endpoint del evento. El parent (EventoLudoteca) maneja el state local —
 * el modal solo dispara el POST y notifica via `onAdded(item)`.
 */
export default function EventoLudotecaPicker({
  eventoId,
  isOpen,
  onClose,
  onAdded,
  existingItems = [],
}) {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const hasBgg = !!user?.bggUsername;
  const [tab, setTab] = useState(hasBgg ? "collection" : "search");
  const [selectedGame, setSelectedGame] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // IDs que el user actual ya tiene agregados — para deshabilitar el "Agregar"
  // en la grilla y evitar el 409 redundante.
  const myAddedIds = useMemo(() => {
    if (!user) return new Set();
    return new Set(
      existingItems
        .filter(
          (it) => String(it.addedBy?._id || it.addedBy) === String(user._id),
        )
        .map((it) => it.bggGameId),
    );
  }, [existingItems, user]);

  // Reset al cerrar/abrir para no arrastrar selección previa.
  useEffect(() => {
    if (!isOpen) {
      setSelectedGame(null);
      setNotes("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedGame || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(`/api/eventos/${eventoId}/ludoteca`, {
        bggGameId: selectedGame.id,
        notes: notes.trim(),
      });
      onAdded?.(data.item);
      addToast({
        type: "evento_ludoteca_added",
        title: "Juego agregado",
        message: `${selectedGame.name} ya está en la ludoteca`,
      });
      onClose?.();
    } catch (err) {
      const msg =
        err.response?.status === 409
          ? "Ya agregaste este juego"
          : err.response?.data?.message ||
            "No pudimos agregar el juego. Reintentá en unos segundos.";
      addToast({ type: "error", title: "Error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Agregar juego a la ludoteca"
      backdropClassName={styles.backdrop}
      className={styles.modal}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Agregar juego</h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {!selectedGame && (
        <>
          <div className={styles.tabs} role="tablist">
            {hasBgg && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "collection"}
                className={`${styles.tab} ${tab === "collection" ? styles.tabActive : ""}`}
                onClick={() => setTab("collection")}
              >
                Mi colección
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={tab === "search"}
              className={`${styles.tab} ${tab === "search" ? styles.tabActive : ""}`}
              onClick={() => setTab("search")}
            >
              Buscar BGG
            </button>
          </div>

          {tab === "collection" && hasBgg ? (
            <CollectionTab
              bggUsername={user.bggUsername}
              onPick={setSelectedGame}
              myAddedIds={myAddedIds}
            />
          ) : tab === "collection" && !hasBgg ? (
            <p className={styles.dim}>
              Conectá tu cuenta BGG en tu perfil para ver tu colección.
            </p>
          ) : (
            <BggGameSearch onPick={setSelectedGame} />
          )}
        </>
      )}

      {selectedGame && (
        <div className={styles.confirm}>
          <div className={styles.preview}>
            {selectedGame.image || selectedGame.thumbnail ? (
              <img
                src={selectedGame.image || selectedGame.thumbnail}
                alt={selectedGame.name}
                className={styles.previewThumb}
              />
            ) : (
              <div className={styles.previewFallback}>🎲</div>
            )}
            <div className={styles.previewInfo}>
              <div className={styles.previewName}>{selectedGame.name}</div>
              {selectedGame.year && (
                <div className={styles.previewYear}>{selectedGame.year}</div>
              )}
            </div>
          </div>

          <label className={styles.notesLabel}>
            Notas (opcional, máx 200)
            <textarea
              className={styles.notesInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder="Ej: edición Sea Floor"
              rows={3}
            />
          </label>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => {
                setSelectedGame(null);
                setNotes("");
              }}
              disabled={submitting}
            >
              ← Elegir otro
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Agregando…" : "Agregar a la ludoteca"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Sub-componente: lista la colección BGG del user con filtro por nombre.
function CollectionTab({ bggUsername, onPick, myAddedIds }) {
  const [games, setGames] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const debouncedFilter = useDebouncedValue(filter, 200);

  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
    axios
      .get(`/api/bgg/coleccion/${encodeURIComponent(bggUsername)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setGames(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No pudimos cargar tu colección.");
      });
    return () => {
      cancelled = true;
    };
  }, [bggUsername]);

  const filtered = useMemo(() => {
    if (!games) return [];
    const q = debouncedFilter.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => (g.name || "").toLowerCase().includes(q));
  }, [games, debouncedFilter]);

  if (error) return <p className={styles.dim}>{error}</p>;
  if (games == null) return <p className={styles.dim}>Cargando colección…</p>;
  if (games.length === 0)
    return (
      <p className={styles.dim}>
        Tu colección de BGG está vacía o aún no se sincronizó.
      </p>
    );

  return (
    <div className={styles.collectionWrap}>
      <input
        type="search"
        className={styles.filterInput}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por nombre…"
        aria-label="Filtrar mi colección"
      />
      {filtered.length === 0 ? (
        <p className={styles.dim}>Sin coincidencias.</p>
      ) : (
        <ul className={styles.collectionGrid}>
          {filtered.map((g) => {
            const numericId = Number(g.id);
            const already = myAddedIds.has(numericId);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className={styles.collectionItem}
                  disabled={already}
                  onClick={() =>
                    onPick({
                      id: numericId,
                      name: g.name,
                      thumbnail: g.thumbnail,
                      image: g.image,
                      year: g.yearPublished,
                    })
                  }
                  title={already ? "Ya lo agregaste" : g.name}
                >
                  {g.image || g.thumbnail ? (
                    <img
                      src={g.image || g.thumbnail}
                      alt={g.name}
                      className={styles.collectionThumb}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.collectionThumbFallback}>🎲</div>
                  )}
                  <span className={styles.collectionName}>{g.name}</span>
                  {already && <span className={styles.addedTag}>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
