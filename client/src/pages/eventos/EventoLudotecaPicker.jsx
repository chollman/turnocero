import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
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
  const { t } = useTranslation("eventos");
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
      const { data } = await axios.post(API.eventos.LUDOTECA(eventoId), {
        bggGameId: selectedGame.id,
        notes: notes.trim(),
      });
      onAdded?.(data.item);
      addToast({
        type: "evento_ludoteca_added",
        title: t("ludoteca.picker.addedTitle"),
        message: t("ludoteca.picker.addedMessage", { game: selectedGame.name }),
      });
      onClose?.();
    } catch (err) {
      const msg =
        err.response?.status === 409
          ? t("ludoteca.picker.errorDuplicate")
          : err.response?.data?.message || t("ludoteca.picker.errorGeneric");
      addToast({
        type: "error",
        title: t("ludoteca.picker.errorTitle"),
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t("ludoteca.picker.modalAria")}
      backdropClassName={styles.backdrop}
      className={styles.modal}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>{t("ludoteca.picker.title")}</h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t("ludoteca.picker.close")}
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
                {t("ludoteca.picker.tabCollection")}
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={tab === "search"}
              className={`${styles.tab} ${tab === "search" ? styles.tabActive : ""}`}
              onClick={() => setTab("search")}
            >
              {t("ludoteca.picker.tabSearch")}
            </button>
          </div>

          {tab === "collection" && hasBgg ? (
            <CollectionTab
              bggUsername={user.bggUsername}
              onPick={setSelectedGame}
              myAddedIds={myAddedIds}
            />
          ) : tab === "collection" && !hasBgg ? (
            <p className={styles.dim}>{t("ludoteca.picker.connectBgg")}</p>
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
            {t("ludoteca.picker.notesLabel")}
            <textarea
              className={styles.notesInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder={t("ludoteca.picker.notesPlaceholder")}
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
              {t("ludoteca.picker.chooseOther")}
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? t("ludoteca.picker.adding")
                : t("ludoteca.picker.addToLudoteca")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Sub-componente: lista la colección BGG del user con filtro por nombre.
function CollectionTab({ bggUsername, onPick, myAddedIds }) {
  const { t } = useTranslation("eventos");
  const [games, setGames] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const debouncedFilter = useDebouncedValue(filter, 200);

  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
    axios
      .get(API.bgg.COLECCION(bggUsername))
      .then(({ data }) => {
        if (cancelled) return;
        setGames(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("ludoteca.picker.collectionError"));
      });
    return () => {
      cancelled = true;
    };
  }, [bggUsername, t]);

  const filtered = useMemo(() => {
    if (!games) return [];
    const q = debouncedFilter.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => (g.name || "").toLowerCase().includes(q));
  }, [games, debouncedFilter]);

  if (error) return <p className={styles.dim}>{error}</p>;
  if (games == null)
    return <p className={styles.dim}>{t("ludoteca.picker.collectionLoading")}</p>;
  if (games.length === 0)
    return <p className={styles.dim}>{t("ludoteca.picker.collectionEmpty")}</p>;

  return (
    <div className={styles.collectionWrap}>
      <input
        type="search"
        className={styles.filterInput}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("ludoteca.picker.filterPlaceholder")}
        aria-label={t("ludoteca.picker.filterAria")}
      />
      {filtered.length === 0 ? (
        <p className={styles.dim}>{t("ludoteca.picker.noMatches")}</p>
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
                  title={already ? t("ludoteca.picker.alreadyAdded") : g.name}
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
