import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import { getLocale } from "../../utils/locale";
import Avatar from "../../components/shared/Avatar";
import CommunitySelect from "../../components/shared/CommunitySelect";
import GameTile from "../../components/shared/GameTile";
import BggGameSearch from "../../components/shared/BggGameSearch";
import RichTextEditor from "../../components/shared/RichTextEditor";
import useRovingRadioGroup from "../../hooks/useRovingRadioGroup";
import { getLocationDisplay } from "../../utils/location";
import { createJuntada, toGamePayload } from "./createJuntada";
import styles from "./CreateCompartidaForm.module.css";

// Las opciones de privacidad solo usan `value`; el label sale por i18n
// (compartidas:privacy.*).
const PRIVACY_VALUES = ["public", "friends", "private"];

const REVIEW_BODY_MAX = 20000;
const MAX_JUNTADA_GAMES = 12;
const TYPE_VALUES = ["resena", "juntada"];
const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

// Texto plano a partir del body (para chequear contenido real: un editor
// vacío produce "<p></p>").
const bodyToText = (html) => (html || "").replace(/<[^>]*>/g, " ").trim();

function formatChipDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString(getLocale(), {
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
  const { t } = useTranslation("compartidas");
  const { user } = useAuth();
  const [category, setCategory] = useState("juntada");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Lista de juegos elegidos: reseña usa 1 (obligatorio); juntada 0..N.
  const [games, setGames] = useState([]); // [{ id, name, thumbnail, image, year }]
  const [rating, setRating] = useState(0); // 0 = sin elegir
  const [privacy, setPrivacy] = useState("public");

  const isResena = category === "resena";
  const maxGames = isResena ? 1 : MAX_JUNTADA_GAMES;
  const canAddGame = games.length < maxGames;

  const addGame = (g) => {
    setGames((prev) => {
      if (prev.length >= maxGames) return prev;
      if (prev.some((x) => x.id === g.id)) return prev; // dedupe
      return [...prev, g];
    });
  };
  const removeGame = (id) =>
    setGames((prev) => prev.filter((x) => x.id !== id));

  // Cambiar de tipo limpia el body (el formato plano ↔ HTML no es compatible)
  // y resetea rating. Si se pasa a reseña, recorta la lista a 1 juego.
  const switchCategory = (next) => {
    if (next === category) return;
    setCategory(next);
    setBody("");
    setRating(0);
    setError("");
    if (next === "resena") {
      setGames((prev) => prev.slice(0, 1));
      // La reseña no usa el control de foto separado (van inline en el editor).
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.preview));
        return [];
      });
    }
  };

  // Roving tabindex + flechas para los radiogroups (tipo y puntuación).
  const typeGroup = useRovingRadioGroup({
    items: TYPE_VALUES,
    value: category,
    onChange: switchCategory,
  });
  const ratingGroup = useRovingRadioGroup({
    items: RATING_VALUES,
    value: rating,
    onChange: setRating,
  });
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
    setImages(
      files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    );
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

  const [community, setCommunity] = useState("");
  const submittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const bodyText = isResena ? bodyToText(body) : body.trim();

    if (isResena) {
      if (games.length === 0) {
        setError(t("form.errorGameRequired"));
        return;
      }
      if (!rating) {
        setError(t("form.errorRatingRequired"));
        return;
      }
      if (!title.trim() && !bodyText) {
        setError(t("form.errorResenaContent"));
        return;
      }
    } else if (!title.trim() && !bodyText && images.length === 0) {
      setError(t("form.errorJuntadaContent"));
      return;
    }

    setError("");
    setLoading(true);
    submittingRef.current = true;
    try {
      const finalPost = await createJuntada({
        payload: {
          category,
          community: community || undefined,
          title: title.trim(),
          body: isResena ? body : body.trim(),
          rating: isResena ? rating : undefined,
          boardGame: isResena && games[0] ? toGamePayload(games[0]) : undefined,
          boardGames: !isResena ? games.map(toGamePayload) : undefined,
          privacy,
          linkedTable: linkedTableId || undefined,
          linkedEvento: linkedEventoId || undefined,
        },
        files: images,
      });
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      onCreated?.(finalPost);
    } catch (err) {
      setError(err.response?.data?.message || t("form.errorPublish"));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const bodyText = isResena ? bodyToText(body) : body.trim();
  const canSubmit = isResena
    ? Boolean(games.length > 0 && rating && (title.trim() || bodyText)) &&
      !loading
    : Boolean(title.trim() || bodyText || images.length > 0) && !loading;

  // Qué falta para poder publicar — guía el botón deshabilitado (sin esto el
  // usuario veía un botón gris sin saber por qué, ya que el error solo se setea
  // en submit y submit está bloqueado).
  const missing = [];
  if (isResena) {
    if (games.length === 0) missing.push(t("form.missingGame"));
    if (!rating) missing.push(t("form.missingRating"));
    if (!title.trim() && !bodyText) missing.push(t("form.missingResenaContent"));
  } else if (!title.trim() && !bodyText && images.length === 0) {
    missing.push(t("form.missingJuntadaContent"));
  }
  const submitHint = !loading && missing.length > 0 ? missing.join(" · ") : "";

  const tableLoc = linkedTable
    ? getLocationDisplay(linkedTable.location, "city")
    : "";
  const eventoLoc = linkedEvento?.location?.texto || "";

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <Avatar user={user} size="md" />
        <span className={styles.prompt}>
          {isResena ? t("form.promptResena") : t("form.promptJuntada")}
        </span>
      </div>

      <CommunitySelect value={community} onChange={setCommunity} />

      {/* ── Tipo: Reseña / Juntada ── */}
      <div
        className={styles.typeToggle}
        role="radiogroup"
        aria-label={t("form.typeGroupAria")}
      >
        <button
          type="button"
          {...typeGroup.getRadioProps("resena", 0)}
          className={`${styles.typeBtn} ${isResena ? styles.typeBtnActive : ""}`}
          onClick={() => switchCategory("resena")}
          disabled={loading}
        >
          <span className={styles.typeIcon} aria-hidden="true">
            📝
          </span>
          <span className={styles.typeName}>{t("form.typeResena")}</span>
          <span className={styles.typeDesc}>{t("form.typeResenaDesc")}</span>
        </button>
        <button
          type="button"
          {...typeGroup.getRadioProps("juntada", 1)}
          className={`${styles.typeBtn} ${!isResena ? styles.typeBtnActive : ""}`}
          onClick={() => switchCategory("juntada")}
          disabled={loading}
        >
          <span className={styles.typeIcon} aria-hidden="true">
            📸
          </span>
          <span className={styles.typeName}>{t("form.typeJuntada")}</span>
          <span className={styles.typeDesc}>{t("form.typeJuntadaDesc")}</span>
        </button>
      </div>

      {/* Visibilidad — al inicio para ambos tipos */}
      <div className={styles.privacyRow}>
        <span className={styles.privacyLabel}>{t("form.visibility")}</span>
        {PRIVACY_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.privacyBtn} ${privacy === value ? styles.privacyBtnActive : ""}`}
            onClick={() => setPrivacy(value)}
            disabled={loading}
          >
            {t(`privacy.${value}`)}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Selector de juego (reseña: 1 obligatorio · juntada: varios opcional) ── */}
      <div className={styles.gameField}>
        <span className={styles.fieldLabel}>
          {isResena ? t("form.gameLabelResena") : t("form.gameLabelJuntada")}
          {isResena ? (
            <span className={styles.req}>{t("form.gameReq")}</span>
          ) : (
            <span className={styles.opt}>{t("form.gameOpt")}</span>
          )}
        </span>

        {games.length > 0 && (
          <div className={styles.gameChips}>
            {games.map((g) => (
              <div key={g.id} className={styles.gameChip}>
                {g.thumbnail || g.image ? (
                  <img
                    src={g.thumbnail || g.image}
                    alt={g.name}
                    className={styles.gameChipImg}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.gameChipImg} aria-hidden="true">
                    🎲
                  </span>
                )}
                <div className={styles.gameChipInfo}>
                  <span className={styles.gameChipName}>{g.name}</span>
                  {g.year && (
                    <span className={styles.gameChipYear}>{g.year}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.linkChipRemove}
                  onClick={() => removeGame(g.id)}
                  disabled={loading}
                  aria-label={t("form.removeGame", { name: g.name })}
                  title={t("form.removeGameTitle")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {canAddGame && (
          <BggGameSearch
            onPick={addGame}
            autoFocus={false}
            clearOnPick={!isResena}
            placeholder={
              isResena
                ? t("form.gameSearchResena")
                : t("form.gameSearchJuntada")
            }
          />
        )}
      </div>

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
            <span className={styles.linkChipLabel}>
              <Meeple />
              {t("form.mesaLinked")}
            </span>
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
            aria-label={t("form.removeMesa")}
            title={t("form.removeMesaTitle")}
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
            <span className={styles.linkChipLabel}>
              <Meeple />
              {t("form.eventoLinked")}
            </span>
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
            aria-label={t("form.removeEvento")}
            title={t("form.removeEventoTitle")}
          >
            ✕
          </button>
        </div>
      )}

      <input
        className={styles.titleInput}
        placeholder={isResena ? t("form.titleResena") : t("form.titleJuntada")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        disabled={loading}
      />

      {isResena ? (
        <RichTextEditor
          value={body}
          onChange={setBody}
          extended
          placeholder={t("form.resenaBodyPlaceholder")}
          maxLength={REVIEW_BODY_MAX}
          disabled={loading}
        />
      ) : (
        <textarea
          className={styles.bodyInput}
          placeholder={t("form.juntadaBodyPlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          disabled={loading}
        />
      )}

      {/* Fotos — solo en juntada. En reseña las imágenes van inline en el
          editor enriquecido, así que no mostramos el control separado. */}
      {!isResena && (
        <>
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
              title={
                images.length >= 3 ? t("form.maxPhotos") : t("form.addPhoto")
              }
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
              <span>
                {images.length > 0
                  ? t("form.photoCount", { count: images.length })
                  : t("form.photo")}
              </span>
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
        </>
      )}

      {/* ── Puntuación (solo reseña) — al final del form ── */}
      {isResena && (
        <div className={styles.ratingField}>
          <span className={styles.fieldLabel}>
            {t("form.ratingLabel")}
            <span className={styles.req}>{t("form.ratingReq")}</span>
          </span>
          <div
            className={styles.ratingPills}
            role="radiogroup"
            aria-label={t("form.ratingAria")}
          >
            {RATING_VALUES.map((n, i) => (
              <button
                key={n}
                type="button"
                {...ratingGroup.getRadioProps(n, i)}
                className={`${styles.ratingPill} ${rating === n ? styles.ratingPillActive : ""}`}
                onClick={() => setRating(n)}
                disabled={loading}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {submitHint && (
          <span className={styles.submitHint} role="status">
            {t("form.missingPrefix", { missing: submitHint })}
          </span>
        )}
        {onCancel && (
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            {t("form.cancel")}
          </button>
        )}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!canSubmit}
        >
          {loading ? t("form.publishing") : t("form.publish")}
        </button>
      </div>
    </form>
  );
}
