import Meeple from "../../components/shared/Meeple";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import { useBggSearchQuery } from "../../queries/bgg";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { fromLocalInputValue } from "../../utils/eventoDate";
import { parseYouTubeVideoId } from "../../utils/youtube";
import { parseBgaUrl } from "../../utils/bga";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
import DateTimePicker from "../../components/shared/DateTimePicker";
import TableCard from "../dashboard/TableCard";
import CommunitySelect from "../../components/shared/CommunitySelect";
import BackButton from "../../components/shared/BackButton";
import styles from "./MesaForm.module.css";

// ── Icons ────────────────────────────────────────────────────────────

const CheckIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const GlobeIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const LockIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UsersIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const EyeOffIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const PlayIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SearchIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const TrashIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
  </svg>
);

// Pasos del wizard. `labelKey` resuelve a i18n en el render (el idioma puede
// cambiar en runtime); `key` es el id estructural usado para refs/scroll/done.
const STEPS = [
  { key: "juego", labelKey: "form.stepJuego" },
  { key: "cuando", labelKey: "form.stepCuando" },
  { key: "donde", labelKey: "form.stepDonde" },
  { key: "detalles", labelKey: "form.stepDetalles" },
  { key: "extras", labelKey: "form.stepExtras" },
];

const PILL_PLAYERS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

// Referencia estable — evita un array nuevo en cada render mientras la
// query BGG no tiene datos.
const EMPTY_SUGGESTIONS = [];

// ── Component ────────────────────────────────────────────────────────

// Wizard de creación / edición de mesas. Layout: 4 secciones (Juego /
// Cuándo / Dónde / Detalles) apiladas, stepper visual arriba indicando
// progreso, y `<TableCard>` a la derecha como vista previa que se actualiza
// en vivo conforme se completan campos.
//
// El componente NO se acopla a la API — sólo expone `onSubmit(payload)`
// y `onDelete()`. CreateTable / EditTable orquestan las llamadas reales.
//
// Props:
//   initialValues   { boardGame, bggData, date, maxPlayers, location, ...}
//   editMode        boolean → game read-only, danger zone, copy distinto
//   playersCount    cuántos jugadores ya se sumaron (para minPlayers + danger copy)
//   submitting      boolean → deshabilita botones mientras se procesa
//   serverError     mensaje del backend si el submit falló
//   onSubmit        (payload) => Promise<void>
//   onCancel        () => void (back button + footer cancel)
//   onDelete        () => void (sólo si editMode — danger zone)
export default function MesaForm({
  initialValues = {},
  editMode = false,
  playersCount = 0,
  submitting = false,
  serverError = "",
  onSubmit,
  onCancel,
  onDelete,
}) {
  const { user } = useAuth();
  const { t } = useTranslation("tables");

  // ── Exit animation ────────────────────────────────────────────────
  // Cuando el user clickea "Volver" o "Cancelar" disparamos un slide-out
  // que es espejo del slideInFromTop de entrada. La navegación real
  // (`onCancel()`) se dispara recién cuando termina el animation event.
  const [exiting, setExiting] = useState(false);
  const handleCancelClick = () => {
    if (exiting) return;
    setExiting(true);
  };
  const handlePageAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return; // ignorar nested animations
    if (e.animationName.includes("mesaFormExit") && exiting) {
      onCancel?.();
    }
  };

  // ── Form state ────────────────────────────────────────────────────
  const [boardGameInput, setBoardGameInput] = useState(
    initialValues.boardGame || "",
  );
  const [bggData, setBggData] = useState(initialValues.bggData || null);
  // El user pasó por el buscador BGG pero eligió NO seleccionar un juego de
  // la lista — clickeó "Usar <texto>" en su lugar. Es puramente informativo
  // (styling + cierre del dropdown): el paso "Juego" ya es válido con sólo
  // tener texto (ver stepDone.juego más abajo), pero esto le da al user una
  // confirmación explícita de que su elección quedó tomada.
  const [manualGameConfirmed, setManualGameConfirmed] = useState(false);
  // Sin default: el user tiene que elegir explícitamente la fecha/hora. El
  // paso "Cuándo" arranca incompleto (stepDone.cuando = false) y el activeStep
  // se desplaza si Juego ya está hecho. En edit mode initialValues.date llega
  // con la fecha existente de la mesa.
  const [date, setDate] = useState(initialValues.date || "");
  const [maxPlayers, setMaxPlayers] = useState(initialValues.maxPlayers || 4);
  const [locationField, setLocationField] = useState(
    initialValues.location || { texto: "", lat: null, lng: null },
  );
  const [description, setDescription] = useState(
    initialValues.description || "",
  );
  const [rules, setRules] = useState(initialValues.rules || "");
  // `tags` queda en estado pero sin UI para editar — preservamos los tags
  // existentes en edit mode (round-trip server→initialValues→submit) sin
  // mostrar el editor. En create siempre arranca [].
  const [tags] = useState(initialValues.tags || []);
  // Sin default: el user tiene que elegir explícitamente "Pública" o
  // "Privada". El paso "Detalles" arranca incompleto (stepDone.detalles
  // requiere `!!privacy`) y el botón "Publicar mesa" queda disabled
  // hasta que se elige. En edit mode initialValues.privacy llega con la
  // privacidad existente del server.
  const [privacy, setPrivacy] = useState(initialValues.privacy || "");
  // Comunidad donde se publica la mesa (solo al crear; oculto si el user tiene
  // una sola comunidad — el server cae a la del skin / base).
  const [community, setCommunity] = useState("");

  // ── Tutoriales (Paso 5 — opcional) ────────────────────────────────
  // Creaciones nuevas defaultean a "none" (lo pidió el user). En edit
  // mode, si el server devolvió un valor lo usamos; si la mesa es vieja
  // (sin campo) se hidrata como "auto" del schema, y el form refleja eso.
  const [tutorialMode, setTutorialMode] = useState(
    initialValues.tutorialMode || (editMode ? "auto" : "none"),
  );
  const [tutorialVideoInput, setTutorialVideoInput] = useState(
    initialValues.tutorialVideoId
      ? `https://www.youtube.com/watch?v=${initialValues.tutorialVideoId}`
      : "",
  );
  // El videoId parseado a partir del URL (memoizado). null si el URL no
  // parsea — eso bloquea el submit cuando el modo es "manual".
  const tutorialVideoId = useMemo(
    () => parseYouTubeVideoId(tutorialVideoInput),
    [tutorialVideoInput],
  );

  // Sub-bloque BGA del Paso 5. Edit mode arranca con el URL ya guardado
  // (si la mesa tenía uno); creaciones nuevas arrancan vacío.
  const [bgaUrlInput, setBgaUrlInput] = useState(initialValues.bgaUrl || "");
  const bgaUrl = useMemo(() => parseBgaUrl(bgaUrlInput), [bgaUrlInput]);

  // ── BGG autocomplete ──────────────────────────────────────────────
  const debouncedSearch = useDebouncedValue(boardGameInput, 400);
  const [showDropdown, setShowDropdown] = useState(false);
  // Cubre el breve lapso entre elegir una sugerencia y que llegue el detalle
  // completo del juego (GET /bgg/game/:id) — desacoplado del `searching` de
  // la lista de sugerencias, que viene de `useBggSearchQuery`.
  const [selectingGame, setSelectingGame] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [localError, setLocalError] = useState("");
  const searchRef = useRef(null);

  // Refs a las 4 secciones (juego/cuando/donde/detalles) para que el
  // stepper pueda scrollear a cada una con un efecto smooth. Mismo orden
  // que `STEPS` — el índice de step se traduce 1-a-1 al ref.
  const sectionRefs = useRef([null, null, null, null]);
  const scrollToStep = (idx) => {
    const el = sectionRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // En editMode el juego es read-only — no buscamos sugerencias. Una vez
  // que hay `bggData` (juego ya elegido) tampoco: tipear después limpia
  // la selección (ver handleGameInputChange) y recién ahí vuelve a buscar.
  const bggSearchEnabled = !editMode && !bggData;
  const { data: suggestions = EMPTY_SUGGESTIONS, isFetching: searching } =
    useBggSearchQuery(debouncedSearch, { enabled: bggSearchEnabled });
  const noResults =
    bggSearchEnabled &&
    !searching &&
    debouncedSearch.trim().length >= 3 &&
    suggestions.length === 0;
  const isSearchBusy = searching || selectingGame;
  const trimmedGameInput = boardGameInput.trim();

  // Reabre el dropdown cuando llega una nueva tanda de resultados (nueva
  // búsqueda) — no en cada render, para no pisar un cierre manual del user
  // (click afuera / focus perdido) mientras los resultados no cambiaron. El
  // dropdown también se abre con texto tipeado aunque BGG no tenga (todavía)
  // resultados, para poder ofrecer la opción "Usar <texto>".
  useEffect(() => {
    if (!bggSearchEnabled || searching) return;
    setShowDropdown(suggestions.length > 0 || debouncedSearch.trim().length > 0);
  }, [bggSearchEnabled, searching, suggestions, debouncedSearch]);

  // Click outside cierra el dropdown.
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleGameInputChange = (e) => {
    setBoardGameInput(e.target.value);
    if (bggData) setBggData(null); // tipear post-pick limpia la selección
    if (manualGameConfirmed) setManualGameConfirmed(false);
  };

  const handleSelectGame = async (game) => {
    setShowDropdown(false);
    setSelectingGame(true);
    try {
      const res = await axios.get(API.bgg.GAME(game.id));
      setBggData(res.data);
      setBoardGameInput(res.data.name);
    } catch {
      setBggData({
        id: game.id,
        name: game.name,
        thumbnail: game.thumbnail,
        image: null,
        year: game.year,
      });
      setBoardGameInput(game.name);
    } finally {
      setSelectingGame(false);
    }
  };

  // El user no quiere (o no encontró) un juego de BGG — confirma el texto
  // tipeado tal cual. Válido para el paso "Juego": la única condición
  // inválida es dejar el campo vacío (ver stepDone.juego).
  const handleUseTypedGame = () => {
    setShowDropdown(false);
    setManualGameConfirmed(true);
  };

  // ── Ubicación ─────────────────────────────────────────────────────
  const updateLocationTexto = (texto) =>
    setLocationField((l) => ({ ...l, texto }));
  const handlePlaceSelect = ({ lat, lng, formattedAddress }) =>
    setLocationField((l) => ({
      texto: formattedAddress || l.texto,
      lat,
      lng,
    }));
  const handleUseMyLocation = () => {
    const d = user?.direccion;
    if (!d?.texto?.trim()) return;
    setLocationField({
      texto: d.texto,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
    });
  };
  const handleManualGeocode = async () => {
    const q = locationField.texto.trim();
    if (q.length < 3) {
      setLocalError(t("form.geocodeTooShort"));
      setTimeout(() => setLocalError(""), 3000);
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await axios.get(API.geocode, { params: { q } });
      setLocationField({
        texto: data.formatted || locationField.texto,
        lat: data.lat,
        lng: data.lng,
      });
    } catch (err) {
      const msg =
        err.response?.status === 404
          ? t("form.geocodeNotFound")
          : err.response?.data?.message || t("form.geocodeError");
      setLocalError(msg);
      setTimeout(() => setLocalError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  // ── Step completion ───────────────────────────────────────────────
  // En edit mode el juego ya viene del server (read-only) — siempre done.
  // En create el "done" sólo requiere texto no vacío: elegir un juego de
  // BGG o confirmar "Usar <texto>" son las dos formas de completarlo, pero
  // ninguna es obligatoria — la única condición inválida es dejar el campo
  // vacío.
  const stepDone = {
    juego: editMode ? true : !!trimmedGameInput,
    cuando: !!date,
    donde:
      !!locationField.texto.trim() ||
      (locationField.lat != null && locationField.lng != null),
    detalles: !!maxPlayers && !!privacy,
    // Paso "Extras" (opcional): combina las dos sub-validaciones —
    // Tutoriales y Board Game Arena. Cada una es opcional por separado;
    // lo único que bloquea es modo "manual" sin URL parseable de YouTube
    // o un input con texto en BGA que no sea de boardgamearena.com.
    extras:
      (tutorialMode === "none" ||
        tutorialMode === "auto" ||
        (tutorialMode === "manual" && !!tutorialVideoId)) &&
      (!bgaUrlInput.trim() || !!bgaUrl),
  };
  const completedCount = Object.values(stepDone).filter(Boolean).length;
  const activeStepIdx = STEPS.findIndex((s) => !stepDone[s.key]);
  const activeStep = activeStepIdx === -1 ? STEPS.length - 1 : activeStepIdx;

  const canSubmit =
    stepDone.juego &&
    stepDone.cuando &&
    stepDone.donde &&
    stepDone.detalles &&
    stepDone.extras;

  // ── Live preview mesa ─────────────────────────────────────────────
  // Construye el shape que `<TableCard>` espera. `maxPlayers` se pasa en
  // formato server (sin contar host) — preview interno calcula host + 1.
  const previewDateIso = useMemo(() => {
    if (!date) return new Date().toISOString();
    try {
      return fromLocalInputValue(date) || new Date(date).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }, [date]);

  // Seed estable para el mosaico del preview: se calcula una sola vez al
  // montar y no depende del input del juego, así el banner aleatorio no
  // muta mientras el user tipea en el buscador BGG. Una vez que el user
  // pickea un juego con `bggData.image`, el banner pasa a ser la imagen
  // del juego y el seed deja de importar.
  const [previewBannerSeed] = useState(() => Math.random().toString(36));

  const previewMesa = useMemo(
    () => ({
      _id: "preview",
      bannerSeedKey: previewBannerSeed,
      boardGame: boardGameInput || t("form.previewGame"),
      bggImage: bggData?.image || null,
      bggThumbnail: bggData?.thumbnail || null,
      bggId: bggData?.id || null,
      date: previewDateIso,
      location: locationField,
      maxPlayers: Math.max(1, Number(maxPlayers) - 1),
      players: [],
      host: user
        ? {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar || { url: "", publicId: "" },
          }
        : {
            _id: "preview-host",
            username: t("form.previewHost"),
            avatar: { url: "", publicId: "" },
          },
      privacy,
      status: "open",
      description,
      rules,
      tags,
      pendingRequests: [],
      followers: [],
      images: [],
      reactions: [],
    }),
    [
      previewBannerSeed,
      boardGameInput,
      bggData,
      previewDateIso,
      locationField,
      maxPlayers,
      user,
      privacy,
      description,
      rules,
      tags,
      t,
    ],
  );

  // ── Submit ────────────────────────────────────────────────────────
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    onSubmit({
      boardGame: bggData?.name || boardGameInput,
      bggId: bggData?.id ?? initialValues.bggData?.id ?? null,
      bggThumbnail:
        bggData?.thumbnail ?? initialValues.bggData?.thumbnail ?? null,
      bggImage: bggData?.image ?? initialValues.bggData?.image ?? null,
      bggYear: bggData?.year ?? initialValues.bggData?.year ?? null,
      date,
      maxPlayers: Number(maxPlayers),
      location: locationField,
      description,
      rules,
      tags,
      privacy,
      ...(!editMode && community ? { community } : {}),
      tutorialMode,
      tutorialVideoId: tutorialMode === "manual" ? tutorialVideoId : null,
      bgaUrl: bgaUrl || null,
    });
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      className={`${styles.page} ${exiting ? styles.pageExit : ""}`}
      onAnimationEnd={handlePageAnimationEnd}
    >
      <BackButton
        onClick={handleCancelClick}
        disabled={submitting || exiting}
      >
        {editMode ? t("form.backEdit") : t("form.backCreate")}
      </BackButton>

      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}>
            <Meeple />
            {editMode ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}
            {t("form.eyebrowSuffix")}
          </p>
          <h1 className={styles.heroTitle}>
            <Trans
              i18nKey={editMode ? "form.heroTitleEdit" : "form.heroTitleCreate"}
              t={t}
              components={{ em: <em /> }}
            />
          </h1>
          <p className={styles.heroSub}>
            {editMode ? t("form.heroSubEdit") : t("form.heroSubCreate")}
          </p>
        </div>
        <div className={styles.heroRight}>
          <span className={styles.heroProgressLabel}>
            {t("form.progressStep", {
              current: activeStep + 1,
              total: STEPS.length,
            })}
          </span>
          <span className={styles.heroProgressValue}>
            {t("form.progressComplete", {
              completed: completedCount,
              total: STEPS.length,
            })}
          </span>
        </div>
      </header>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={handleFormSubmit}>
          {/* Stepper — cada dot es clickeable y scrollea suave al inicio
                de su sección (`scrollIntoView` con `behavior: "smooth"`). */}
          <div
            className={styles.steps}
            role="tablist"
            aria-label={t("form.progressAria")}
          >
            {STEPS.map((s, i) => {
              const done = stepDone[s.key] && i !== activeStep;
              const active = i === activeStep;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`mesa-form-section-${s.key}`}
                  className={`${styles.step} ${active ? styles.stepActive : ""} ${done ? styles.stepDone : ""}`}
                  onClick={() => scrollToStep(i)}
                >
                  <span className={styles.stepDot}>
                    {done ? <CheckIcon size={13} /> : i + 1}
                  </span>
                  <span className={styles.stepLabel}>{t(s.labelKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Paso 1 · Juego */}
          <section
            ref={(el) => (sectionRefs.current[0] = el)}
            id="mesa-form-section-juego"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                {t("form.step1")}
              </span>
              <span className={styles.sectionTitle}>
                {t("form.sectionGame")}
              </span>
            </header>

            <div className={styles.field} ref={searchRef}>
              <label className={styles.fieldLabel} htmlFor="mesa-game">
                {t("form.gameLabel")}
                <span className={styles.required}>{t("form.required")}</span>
              </label>
              {editMode ? (
                <div className={styles.readOnly}>{boardGameInput}</div>
              ) : (
                <>
                  <input
                    id="mesa-game"
                    type="text"
                    className={`${styles.input} ${bggData || manualGameConfirmed ? styles.inputSelected : ""}`}
                    value={boardGameInput}
                    onChange={handleGameInputChange}
                    onFocus={() =>
                      (suggestions.length > 0 || trimmedGameInput) &&
                      !bggData &&
                      setShowDropdown(true)
                    }
                    placeholder={t("form.gamePlaceholder")}
                    autoComplete="off"
                  />
                  {isSearchBusy && (
                    <span className={styles.fieldHelp}>
                      {t("form.searching")}
                    </span>
                  )}
                  {noResults && !isSearchBusy && !manualGameConfirmed && (
                    <span className={styles.fieldHelp}>
                      {t("form.noResults")}
                    </span>
                  )}
                  {!isSearchBusy &&
                    !noResults &&
                    !bggData &&
                    !manualGameConfirmed && (
                      <span className={styles.fieldHelp}>
                        {t("form.gameHelp")}
                      </span>
                    )}
                  {manualGameConfirmed && !bggData && (
                    <span className={styles.fieldHelp}>
                      {t("form.useTypedGameConfirmed")}
                    </span>
                  )}
                  {showDropdown && (suggestions.length > 0 || trimmedGameInput) && (
                    <ul className={styles.suggestions}>
                      {trimmedGameInput && (
                        <li>
                          <button
                            type="button"
                            className={styles.suggestionCreateBtn}
                            onMouseDown={handleUseTypedGame}
                          >
                            <span className={styles.suggestionThumbFallback}>
                              ＋
                            </span>
                            <span className={styles.suggestionName}>
                              {t("form.useTypedGame", {
                                game: trimmedGameInput,
                              })}
                            </span>
                          </button>
                        </li>
                      )}
                      {suggestions.map((g) => (
                        <li key={g.id}>
                          <button
                            type="button"
                            className={styles.suggestionItem}
                            onMouseDown={() => handleSelectGame(g)}
                          >
                            {g.thumbnail ? (
                              <img
                                src={g.thumbnail}
                                alt=""
                                className={styles.suggestionThumb}
                                loading="lazy"
                              />
                            ) : (
                              <span className={styles.suggestionThumbFallback}>
                                🎲
                              </span>
                            )}
                            <span className={styles.suggestionName}>
                              {g.name}
                            </span>
                            {g.year && (
                              <span className={styles.suggestionYear}>
                                {g.year}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Paso 2 · Cuándo */}
          <section
            ref={(el) => (sectionRefs.current[1] = el)}
            id="mesa-form-section-cuando"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                {t("form.step2")}
              </span>
              <span className={styles.sectionTitle}>
                {t("form.sectionWhen")}
              </span>
            </header>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="mesa-date">
                {t("form.dateLabel")}
                <span className={styles.required}>{t("form.required")}</span>
              </label>
              <DateTimePicker
                id="mesa-date"
                name="date"
                value={date}
                onChange={setDate}
                required
              />
              <span className={styles.fieldHelp}>{t("form.dateHelp")}</span>
            </div>
          </section>

          {/* Paso 3 · Dónde */}
          <section
            ref={(el) => (sectionRefs.current[2] = el)}
            id="mesa-form-section-donde"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                {t("form.step3")}
              </span>
              <span className={styles.sectionTitle}>
                {t("form.sectionWhere")}
              </span>
            </header>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("form.placeLabel")}
                <span className={styles.required}>{t("form.required")}</span>
              </label>
              {user?.direccion?.texto?.trim() && (
                <button
                  type="button"
                  className={styles.btnMyLocation}
                  onClick={handleUseMyLocation}
                  title={t("form.useMyLocationTitle", {
                    address: user.direccion.texto,
                  })}
                >
                  {t("form.myLocation")}
                </button>
              )}
              <div className={styles.locationRow}>
                <PlaceAutocomplete
                  value={locationField.texto}
                  onChange={updateLocationTexto}
                  onSelect={handlePlaceSelect}
                  placeholder={t("form.placePlaceholder")}
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleManualGeocode}
                  disabled={geocoding}
                >
                  {geocoding ? "…" : t("form.search")}
                </button>
              </div>
              <span className={styles.fieldHelp}>{t("form.placeHelp")}</span>
            </div>
          </section>

          {/* Paso 4 · Detalles */}
          <section
            ref={(el) => (sectionRefs.current[3] = el)}
            id="mesa-form-section-detalles"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                {t("form.step4")}
              </span>
              <span className={styles.sectionTitle}>
                {t("form.sectionDetails")}
              </span>
            </header>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("form.playersLabel")}
                <span className={styles.required}>{t("form.required")}</span>
              </label>
              <div className={styles.pillGroup}>
                {PILL_PLAYERS.map((n) => {
                  const disabled = editMode && n <= playersCount;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.pillBtn} ${maxPlayers === n ? styles.pillActive : ""}`}
                      onClick={() => setMaxPlayers(n)}
                      disabled={disabled}
                      title={
                        disabled
                          ? t("form.playersDisabledTitle", {
                              count: playersCount,
                            })
                          : undefined
                      }
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <span className={styles.fieldHelp}>
                {t("form.playersFreeHelp", { count: maxPlayers - 1 })}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("form.privacyLabel")}
                <span className={styles.required}>{t("form.required")}</span>
              </label>
              <div className={styles.privacyOptions}>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${privacy === "public" ? styles.privacyCardActive : ""}`}
                  onClick={() => setPrivacy("public")}
                >
                  <GlobeIcon size={22} />
                  <div className={styles.privacyCardBody}>
                    <span className={styles.privacyCardTitle}>
                      {t("form.privacyPublic")}
                    </span>
                    <span className={styles.privacyCardSub}>
                      {t("form.privacyPublicSub")}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${privacy === "friends" ? styles.privacyCardActive : ""}`}
                  onClick={() => setPrivacy("friends")}
                >
                  <UsersIcon size={22} />
                  <div className={styles.privacyCardBody}>
                    <span className={styles.privacyCardTitle}>
                      {t("form.privacyFriends")}
                    </span>
                    <span className={styles.privacyCardSub}>
                      {t("form.privacyFriendsSub")}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${privacy === "private" ? styles.privacyCardActive : ""}`}
                  onClick={() => setPrivacy("private")}
                >
                  <LockIcon size={22} />
                  <div className={styles.privacyCardBody}>
                    <span className={styles.privacyCardTitle}>
                      {t("form.privacyPrivate")}
                    </span>
                    <span className={styles.privacyCardSub}>
                      {t("form.privacyPrivateSub")}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {!editMode && (
              <div className={styles.field}>
                <CommunitySelect value={community} onChange={setCommunity} />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="mesa-desc">
                {t("form.descLabel")}
              </label>
              <textarea
                id="mesa-desc"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("form.descPlaceholder")}
                maxLength={500}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="mesa-rules">
                {t("form.rulesLabel")}
              </label>
              <textarea
                id="mesa-rules"
                className={styles.textarea}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder={t("form.rulesPlaceholder")}
                maxLength={500}
                rows={3}
              />
            </div>
          </section>

          {/* Paso 5 · Extras (opcional) — tutoriales + Board Game Arena */}
          <section
            ref={(el) => (sectionRefs.current[4] = el)}
            id="mesa-form-section-extras"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                {t("form.extrasLabel")}
              </span>
              <span className={styles.sectionRule} />
            </header>
            <p className={styles.sectionHelp}>{t("form.extrasHelp")}</p>

            {/* Sub-bloque 1 · Tutoriales de YouTube */}
            <div className={styles.subBlock}>
              <h4 className={styles.subBlockLabel}>
                {t("form.tutorialsTitle")}
              </h4>
              <p className={styles.subBlockHelp}>{t("form.tutorialsHelp")}</p>

              <div className={styles.field}>
                <div className={styles.privacyOptions}>
                  <button
                    type="button"
                    className={`${styles.privacyCard} ${tutorialMode === "none" ? styles.privacyCardActive : ""}`}
                    onClick={() => setTutorialMode("none")}
                  >
                    <EyeOffIcon size={22} />
                    <div className={styles.privacyCardBody}>
                      <span className={styles.privacyCardTitle}>
                        {t("form.tutorialNoneTitle")}
                      </span>
                      <span className={styles.privacyCardSub}>
                        {t("form.tutorialNoneSub")}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.privacyCard} ${tutorialMode === "manual" ? styles.privacyCardActive : ""}`}
                    onClick={() => setTutorialMode("manual")}
                  >
                    <PlayIcon size={22} />
                    <div className={styles.privacyCardBody}>
                      <span className={styles.privacyCardTitle}>
                        {t("form.tutorialManualTitle")}
                      </span>
                      <span className={styles.privacyCardSub}>
                        {t("form.tutorialManualSub")}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${styles.privacyCard} ${tutorialMode === "auto" ? styles.privacyCardActive : ""}`}
                    onClick={() => setTutorialMode("auto")}
                  >
                    <SearchIcon size={22} />
                    <div className={styles.privacyCardBody}>
                      <span className={styles.privacyCardTitle}>
                        {t("form.tutorialAutoTitle")}
                      </span>
                      <span className={styles.privacyCardSub}>
                        {t("form.tutorialAutoSub", {
                          game: boardGameInput || t("form.gameFallback"),
                        })}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {tutorialMode === "manual" && (
                <div className={styles.field}>
                  <label
                    className={styles.fieldLabel}
                    htmlFor="mesa-tutorial-url"
                  >
                    {t("form.tutorialUrlLabel")}
                    <span className={styles.required}>{t("form.required")}</span>
                  </label>
                  <input
                    id="mesa-tutorial-url"
                    type="url"
                    className={styles.input}
                    value={tutorialVideoInput}
                    onChange={(e) => setTutorialVideoInput(e.target.value)}
                    placeholder={t("form.tutorialUrlPlaceholder")}
                    autoComplete="off"
                  />
                  {tutorialVideoInput.trim() && !tutorialVideoId && (
                    <span
                      className={styles.fieldHelp}
                      style={{ color: "var(--red)" }}
                    >
                      {t("form.tutorialUrlInvalid")}
                    </span>
                  )}
                  {tutorialVideoId && (
                    <span className={styles.fieldHelp}>
                      {t("form.tutorialDetected")}
                      <code style={{ color: "var(--amber)" }}>
                        {tutorialVideoId}
                      </code>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={styles.subBlockDivider} aria-hidden="true" />

            {/* Sub-bloque 2 · Board Game Arena */}
            <div className={styles.subBlock}>
              <h4 className={styles.subBlockLabel}>{t("form.bgaTitle")}</h4>
              <p className={styles.subBlockHelp}>
                <Trans
                  i18nKey="form.bgaHelp"
                  t={t}
                  components={{ 1: <strong /> }}
                />
              </p>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="mesa-bga-url">
                  {t("form.bgaUrlLabel")}
                </label>
                <input
                  id="mesa-bga-url"
                  type="url"
                  className={styles.input}
                  value={bgaUrlInput}
                  onChange={(e) => setBgaUrlInput(e.target.value)}
                  placeholder={t("form.bgaUrlPlaceholder")}
                  autoComplete="off"
                />
                {bgaUrlInput.trim() && !bgaUrl && (
                  <span
                    className={styles.fieldHelp}
                    style={{ color: "var(--red)" }}
                  >
                    {t("form.bgaUrlInvalid")}
                  </span>
                )}
                {bgaUrl && (
                  <span className={styles.fieldHelp}>
                    {t("form.bgaUrlValid")}
                  </span>
                )}
              </div>
            </div>
          </section>

          {(serverError || localError) && (
            <div className={styles.errorBox}>{serverError || localError}</div>
          )}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={handleCancelClick}
              disabled={submitting || exiting}
            >
              {editMode ? t("form.discardEdit") : t("form.cancel")}
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!canSubmit || submitting}
            >
              {submitting
                ? t("form.ellipsis")
                : editMode
                  ? t("form.saveChanges")
                  : t("form.publish")}
            </button>
          </div>

          {editMode && onDelete && (
            <div className={styles.dangerZone}>
              <div className={styles.dangerLabel}>
                <Meeple />
                {t("form.dangerLabel")}
              </div>
              <div className={styles.dangerTitle}>{t("form.dangerTitle")}</div>
              <p className={styles.dangerSub}>
                {t("form.dangerSubPrefix")}
                {playersCount > 0
                  ? t("form.dangerSubWithPlayers", { count: playersCount })
                  : t("form.dangerSubNoPlayers")}
              </p>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={onDelete}
                disabled={submitting}
              >
                <TrashIcon /> {t("form.dangerBtn")}
              </button>
            </div>
          )}
        </form>

        <aside className={styles.preview}>
          <div className={styles.previewLabel}>
            <Meeple />
            {t("form.previewLabel")}
          </div>
          <div className={styles.previewCard} aria-hidden="true">
            <TableCard
              table={previewMesa}
              onUpdate={() => {}}
              onCancel={() => {}}
            />
          </div>
          <p className={styles.previewNote}>{t("form.previewNote")}</p>
        </aside>
      </div>
    </div>
  );
}
