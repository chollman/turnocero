import { useRef } from "react";
import { useTranslation } from "react-i18next";
import BggGameSearch from "../../components/shared/BggGameSearch";
// Reusamos las clases del form de compartidas para que la sección "Compartí esta
// partida" se vea idéntica a una juntada. El layout/gap propio va en el módulo local.
import shared from "./CreateCompartidaForm.module.css";
import styles from "./JuntadaFields.module.css";

const PRIVACY_OPTIONS = [
  { value: "public", labelKey: "privacyPublic" },
  { value: "friends", labelKey: "privacyFriends" },
  { value: "private", labelKey: "privacyPrivate" },
];
const MAX_GAMES = 12;
const MAX_IMAGES = 3;

/**
 * Campos de una juntada (controlado): visibilidad, juegos, título, texto y fotos.
 * Es la parte reutilizable del form de Compartidas tipo "juntada", para embeberla
 * tanto en la página de Compartidas como en el form de carga de partidas de BG Watch.
 *
 * Props:
 * - value: { privacy, games:[{id,name,thumbnail,image,year}], title, body,
 *   images:[{file,preview}], crosspostInstagram:{feed,story} }
 * - onChange(next): recibe el value completo actualizado.
 * - disabled: deshabilita todos los controles (mientras se envía).
 * - instagramAvailable: el padre ya resolvió que la sección está prendida Y
 *   el usuario tiene Instagram conectado y válido — el componente solo decide
 *   si además se cumplen las condiciones propias del post (público + con foto).
 *
 * Las fotos viven como `{ file, preview }` con `preview` = objectURL para el
 * thumbnail; se crean al agregar y se revocan al quitar. El consumidor debe
 * revocar las que queden tras un submit exitoso.
 */
export default function JuntadaFields({
  value,
  onChange,
  disabled = false,
  instagramAvailable = false,
}) {
  const { t } = useTranslation("compartidas");
  const {
    privacy,
    games,
    title,
    body,
    images,
    crosspostInstagram = { feed: false, story: false },
  } = value;
  const fileInputRef = useRef(null);
  const set = (patch) => onChange({ ...value, ...patch });

  const addGame = (g) => {
    if (games.length >= MAX_GAMES) return;
    if (games.some((x) => x.id === g.id)) return; // dedupe
    set({ games: [...games, g] });
  };
  const removeGame = (id) => set({ games: games.filter((x) => x.id !== id) });

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - images.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    if (toAdd.length) set({ images: [...images, ...toAdd] });
    e.target.value = "";
  };
  const removeImage = (idx) => {
    URL.revokeObjectURL(images[idx].preview);
    set({ images: images.filter((_, i) => i !== idx) });
  };

  return (
    <div className={styles.fields}>
      {/* Visibilidad */}
      <div className={shared.privacyRow}>
        <span className={shared.privacyLabel}>{t("juntada.visibility")}</span>
        {PRIVACY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${shared.privacyBtn} ${privacy === opt.value ? shared.privacyBtnActive : ""}`}
            onClick={() => set({ privacy: opt.value })}
            disabled={disabled}
          >
            {t(`juntada.${opt.labelKey}`)}
          </button>
        ))}
      </div>

      {/* Juegos (0..N, opcional) */}
      <div className={shared.gameField}>
        <span className={shared.fieldLabel}>
          {t("juntada.games")}
          <span className={shared.opt}>{t("juntada.gamesOpt")}</span>
        </span>

        {games.length > 0 && (
          <div className={shared.gameChips}>
            {games.map((g) => (
              <div key={g.id} className={shared.gameChip}>
                {g.thumbnail || g.image ? (
                  <img
                    src={g.thumbnail || g.image}
                    alt={g.name}
                    className={shared.gameChipImg}
                    loading="lazy"
                  />
                ) : (
                  <span className={shared.gameChipImg} aria-hidden="true">
                    🎲
                  </span>
                )}
                <div className={shared.gameChipInfo}>
                  <span className={shared.gameChipName}>{g.name}</span>
                  {g.year && (
                    <span className={shared.gameChipYear}>{g.year}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={shared.linkChipRemove}
                  onClick={() => removeGame(g.id)}
                  disabled={disabled}
                  aria-label={t("juntada.removeGame", { name: g.name })}
                  title={t("juntada.removeGameTitle")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {games.length < MAX_GAMES && (
          <BggGameSearch
            onPick={addGame}
            autoFocus={false}
            clearOnPick
            placeholder={t("juntada.gameSearchPlaceholder")}
          />
        )}
      </div>

      {/* Título */}
      <input
        className={shared.titleInput}
        placeholder={t("juntada.titlePlaceholder")}
        value={title}
        onChange={(e) => set({ title: e.target.value })}
        maxLength={100}
        disabled={disabled}
      />

      {/* Texto */}
      <textarea
        className={shared.bodyInput}
        placeholder={t("juntada.bodyPlaceholder")}
        value={body}
        onChange={(e) => set({ body: e.target.value })}
        rows={4}
        maxLength={2000}
        disabled={disabled}
      />

      {/* Fotos (máx 3) */}
      {images.length > 0 && (
        <div className={shared.previews}>
          {images.map((img, i) => (
            <div key={i} className={shared.previewWrap}>
              <img src={img.preview} alt="" className={shared.preview} />
              <button
                type="button"
                className={shared.removeImg}
                onClick={() => removeImage(i)}
                aria-label={t("juntada.removePhoto")}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={shared.controls}>
        <button
          type="button"
          className={shared.photoBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES || disabled}
          title={
            images.length >= MAX_IMAGES
              ? t("juntada.maxPhotos")
              : t("juntada.addPhoto")
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
              ? t("juntada.photoCount", { count: images.length })
              : t("juntada.photo")}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className={shared.fileInput}
          onChange={handleImageSelect}
        />
      </div>

      {/* Cross-post a Instagram — solo aplica a juntadas públicas con al
          menos 1 foto (Instagram es inherentemente público). */}
      {instagramAvailable && (
        <div className={shared.instagramSection}>
          {privacy === "public" && images.length > 0 ? (
            <>
              <span className={shared.fieldLabel}>
                {t("juntada.instagramLabel")}
              </span>
              <div className={shared.instagramOptions}>
                <label className={shared.instagramCheckbox}>
                  <input
                    type="checkbox"
                    checked={!!crosspostInstagram.feed}
                    onChange={(e) =>
                      set({
                        crosspostInstagram: {
                          ...crosspostInstagram,
                          feed: e.target.checked,
                        },
                      })
                    }
                    disabled={disabled}
                  />
                  {t("juntada.instagramFeed")}
                </label>
                <label className={shared.instagramCheckbox}>
                  <input
                    type="checkbox"
                    checked={!!crosspostInstagram.story}
                    onChange={(e) =>
                      set({
                        crosspostInstagram: {
                          ...crosspostInstagram,
                          story: e.target.checked,
                        },
                      })
                    }
                    disabled={disabled}
                  />
                  {t("juntada.instagramStory")}
                </label>
              </div>
            </>
          ) : (
            <p className={shared.instagramHint}>
              {privacy !== "public"
                ? t("juntada.instagramNeedsPublic")
                : t("juntada.instagramNeedsPhoto")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
