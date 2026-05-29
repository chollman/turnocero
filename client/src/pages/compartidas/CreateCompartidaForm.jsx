import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import GameTile from "../../components/shared/GameTile";
import { getLocationDisplay } from "../../utils/location";
import styles from "./CreateCompartidaForm.module.css";

const PRIVACY_OPTIONS = [
  { value: "public", label: "Público", desc: "Todos" },
  { value: "friends", label: "Amigos", desc: "Solo amigos" },
  { value: "private", label: "Solo yo", desc: "Privado" },
];

function formatChipDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

export default function CreateCompartidaForm({
  onCreated,
  onCancel,
  prefilledTableId,
  prefilledEventoId,
  initialFiles,
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [privacy, setPrivacy] = useState("public");
  // El linking es solo contextual: el id viene de la mesa/evento desde donde
  // se abrió la compartida (no hay dropdown manual). Mostramos un chip quitable.
  const [linkedTableId, setLinkedTableId] = useState(prefilledTableId || "");
  const [linkedEventoId, setLinkedEventoId] = useState(prefilledEventoId || "");
  const [linkedTable, setLinkedTable] = useState(null);
  const [linkedEvento, setLinkedEvento] = useState(null);
  const [images, setImages] = useState([]); // [{ file, preview }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Sembrar fotos pasadas desde el composer ("Subir foto"). Una sola vez —
  // ref guarda contra el doble-invoke de StrictMode (evita previews duplicadas).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const files = Array.from(initialFiles || []).slice(0, 3);
    if (files.length === 0) return;
    setImages(files.map((file) => ({ file, preview: URL.createObjectURL(file) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolver la mesa/evento prefilled para renderizar el chip. Si el fetch
  // falla (403/404/sin acceso), limpiamos el id para no enviar un link inválido.
  useEffect(() => {
    if (!prefilledTableId) return undefined;
    const ac = new AbortController();
    axios
      .get(API.tables.DETAIL(prefilledTableId), { signal: ac.signal })
      .then(({ data }) => {
        if (!ac.signal.aborted) setLinkedTable(data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setLinkedTable(null);
        setLinkedTableId("");
      });
    return () => ac.abort();
  }, [prefilledTableId]);

  useEffect(() => {
    if (!prefilledEventoId) return undefined;
    const ac = new AbortController();
    axios
      .get(API.eventos.DETAIL(prefilledEventoId), { signal: ac.signal })
      .then(({ data }) => {
        if (!ac.signal.aborted) setLinkedEvento(data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setLinkedEvento(null);
        setLinkedEventoId("");
      });
    return () => ac.abort();
  }, [prefilledEventoId]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - images.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const unlinkTable = () => {
    setLinkedTable(null);
    setLinkedTableId("");
  };

  const unlinkEvento = () => {
    setLinkedEvento(null);
    setLinkedEventoId("");
  };

  const submittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!title.trim() && !body.trim() && images.length === 0) {
      setError("Agregá al menos un título, texto o foto.");
      return;
    }
    setError("");
    setLoading(true);
    submittingRef.current = true;
    let createdId = null;
    try {
      const { data: created } = await axios.post(API.compartidas.LIST, {
        title: title.trim(),
        body: body.trim(),
        privacy,
        linkedTable: linkedTableId || undefined,
        linkedEvento: linkedEventoId || undefined,
      });
      createdId = created._id;

      let finalPost = created;
      for (const img of images) {
        const fd = new FormData();
        fd.append("image", img.file);
        const { data: updatedImages } = await axios.post(
          API.compartidas.IMAGES(created._id),
          fd,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        finalPost = { ...finalPost, images: updatedImages };
      }

      images.forEach((img) => URL.revokeObjectURL(img.preview));
      onCreated?.(finalPost);
    } catch (err) {
      if (createdId) {
        try {
          await axios.delete(API.compartidas.DETAIL(createdId));
        } catch {
          /* ignore */
        }
      }
      setError(
        err.response?.data?.message || "Error al publicar la compartida",
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const canSubmit =
    (title.trim() || body.trim() || images.length > 0) && !loading;

  const tableLoc = linkedTable
    ? getLocationDisplay(linkedTable.location, "city")
    : "";
  const eventoLoc = linkedEvento?.location?.texto || "";

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <Avatar user={user} size="md" />
        <span className={styles.prompt}>¿Cómo estuvo la compartida?</span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Chip de mesa enlazada (contextual, quitable) ── */}
      {linkedTable && (
        <div className={styles.linkChip}>
          <div className={styles.linkChipTile}>
            <GameTile
              game={linkedTable.boardGame}
              seed={linkedTable._id?.charCodeAt(0) || 42}
              size={40}
              imageUrl={linkedTable.bggThumbnail}
            />
          </div>
          <div className={styles.linkChipInfo}>
            <span className={styles.linkChipLabel}>◆ Mesa enlazada</span>
            <span className={styles.linkChipName}>{linkedTable.boardGame}</span>
            <span className={styles.linkChipMeta}>
              {formatChipDate(linkedTable.date)}
              {tableLoc ? ` · ${tableLoc}` : ""}
            </span>
          </div>
          <button
            type="button"
            className={styles.linkChipRemove}
            onClick={unlinkTable}
            disabled={loading}
            aria-label="Quitar mesa enlazada"
            title="Quitar mesa"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Chip de evento enlazado (contextual, quitable) ── */}
      {linkedEvento && (
        <div className={styles.linkChip}>
          <div className={styles.linkChipTile} aria-hidden="true">
            <span style={{ fontSize: 22 }}>🎟️</span>
          </div>
          <div className={styles.linkChipInfo}>
            <span className={styles.linkChipLabel}>◆ Evento enlazado</span>
            <span className={styles.linkChipName}>{linkedEvento.title}</span>
            <span className={styles.linkChipMeta}>
              {formatChipDate(linkedEvento.eventDate)}
              {eventoLoc ? ` · ${eventoLoc}` : ""}
            </span>
          </div>
          <button
            type="button"
            className={styles.linkChipRemove}
            onClick={unlinkEvento}
            disabled={loading}
            aria-label="Quitar evento enlazado"
            title="Quitar evento"
          >
            ✕
          </button>
        </div>
      )}

      <input
        className={styles.titleInput}
        placeholder="Título (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        disabled={loading}
      />

      <textarea
        className={styles.bodyInput}
        placeholder="Contá cómo salió, qué jugaron, anécdotas…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        disabled={loading}
      />

      {/* Image previews */}
      {images.length > 0 && (
        <div className={styles.previews}>
          {images.map((img, i) => (
            <div key={i} className={styles.previewWrap}>
              <img src={img.preview} alt="" className={styles.preview} />
              <button
                type="button"
                className={styles.removeImg}
                onClick={() => removeImage(i)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.controls}>
        {/* Photo picker */}
        <button
          type="button"
          className={styles.photoBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= 3 || loading}
          title={images.length >= 3 ? "Máximo 3 fotos" : "Agregar foto"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>Foto {images.length > 0 ? `(${images.length}/3)` : ""}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className={styles.fileInput}
          onChange={handleImageSelect}
        />
      </div>

      {/* Privacy */}
      <div className={styles.privacyRow}>
        <span className={styles.privacyLabel}>Visibilidad:</span>
        {PRIVACY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.privacyBtn} ${privacy === opt.value ? styles.privacyBtnActive : ""}`}
            onClick={() => setPrivacy(opt.value)}
            disabled={loading}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!canSubmit}
        >
          {loading ? "Publicando…" : "Publicar compartida"}
        </button>
      </div>
    </form>
  );
}
