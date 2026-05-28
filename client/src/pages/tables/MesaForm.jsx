import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { fromLocalInputValue } from "../../utils/eventoDate";
import { parseYouTubeVideoId } from "../../utils/youtube";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
import DateTimePicker from "../../components/shared/DateTimePicker";
import TableCard from "../dashboard/TableCard";
import styles from "./MesaForm.module.css";

// ── Icons ────────────────────────────────────────────────────────────

const ArrowLeftIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

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

const STEPS = [
  { key: "juego", label: "Juego" },
  { key: "cuando", label: "Cuándo" },
  { key: "donde", label: "Dónde" },
  { key: "detalles", label: "Detalles" },
  { key: "tutoriales", label: "Tutoriales" },
];

const PILL_PLAYERS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

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

  // ── BGG autocomplete ──────────────────────────────────────────────
  const debouncedSearch = useDebouncedValue(boardGameInput, 400);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [localError, setLocalError] = useState("");
  const searchRef = useRef(null);
  const abortRef = useRef(null);
  const searchCache = useRef(new Map());

  // Refs a las 4 secciones (juego/cuando/donde/detalles) para que el
  // stepper pueda scrollear a cada una con un efecto smooth. Mismo orden
  // que `STEPS` — el índice de step se traduce 1-a-1 al ref.
  const sectionRefs = useRef([null, null, null, null]);
  const scrollToStep = (idx) => {
    const el = sectionRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    // En editMode el juego es read-only — no buscamos sugerencias.
    if (editMode) return undefined;
    if (debouncedSearch.length < 3 || bggData) {
      setSuggestions([]);
      setShowDropdown(false);
      setSearching(false);
      setNoResults(false);
      return undefined;
    }
    const q = debouncedSearch.toLowerCase();
    const cached = searchCache.current.get(q);
    if (cached) {
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setNoResults(cached.length === 0);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    setNoResults(false);
    setShowDropdown(false);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    (async () => {
      try {
        const res = await axios.get(API.bgg.SEARCH, {
          params: { q: debouncedSearch },
          signal,
        });
        if (signal.aborted) return;
        searchCache.current.set(q, res.data);
        setSuggestions(res.data);
        if (res.data.length > 0) setShowDropdown(true);
        else setNoResults(true);
      } catch (err) {
        if (!axios.isCancel(err)) setSuggestions([]);
      } finally {
        if (!signal.aborted) setSearching(false);
      }
    })();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [debouncedSearch, bggData, editMode]);

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
  };

  const handleSelectGame = async (game) => {
    setShowDropdown(false);
    setSearching(true);
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
      setSearching(false);
    }
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
      setLocalError("Escribí una dirección de al menos 3 caracteres.");
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
          ? "No se encontró la dirección. Intentá ser más específico o picá una sugerencia."
          : err.response?.data?.message || "Error al buscar la dirección.";
      setLocalError(msg);
      setTimeout(() => setLocalError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  // ── Step completion ───────────────────────────────────────────────
  // En edit mode el juego ya viene del server (read-only) — siempre done.
  // En create el "done" requiere haber seleccionado de la lista de BGG.
  const stepDone = {
    juego: editMode ? true : !!bggData && !!boardGameInput.trim(),
    cuando: !!date,
    donde:
      !!locationField.texto.trim() ||
      (locationField.lat != null && locationField.lng != null),
    detalles: !!maxPlayers && !!privacy,
    // Tutoriales es "opcional" en el sentido del producto: "none" y "auto"
    // están listos sin más input. El único caso que bloquea el submit es
    // "manual" sin un URL parseable.
    tutoriales:
      tutorialMode === "none" ||
      tutorialMode === "auto" ||
      (tutorialMode === "manual" && !!tutorialVideoId),
  };
  const completedCount = Object.values(stepDone).filter(Boolean).length;
  const activeStepIdx = STEPS.findIndex((s) => !stepDone[s.key]);
  const activeStep = activeStepIdx === -1 ? STEPS.length - 1 : activeStepIdx;

  const canSubmit =
    stepDone.juego &&
    stepDone.cuando &&
    stepDone.donde &&
    stepDone.detalles &&
    stepDone.tutoriales;

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
  const previewBannerSeed = useMemo(() => Math.random().toString(36), []);

  const previewMesa = useMemo(
    () => ({
      _id: "preview",
      bannerSeedKey: previewBannerSeed,
      boardGame: boardGameInput || "Tu juego",
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
            username: "Vos",
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
      tutorialMode,
      tutorialVideoId: tutorialMode === "manual" ? tutorialVideoId : null,
    });
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      className={`${styles.page} ${exiting ? styles.pageExit : ""}`}
      onAnimationEnd={handlePageAnimationEnd}
    >
      <button
        type="button"
        className={styles.backBtn}
        onClick={handleCancelClick}
        disabled={submitting || exiting}
      >
        <ArrowLeftIcon /> {editMode ? "Cancelar edición" : "Cancelar y volver"}
      </button>

      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}>
            ◆ {editMode ? "Editar mesa" : "Nueva mesa"} · paso a paso
          </p>
          <h1 className={styles.heroTitle}>
            {editMode ? (
              <>
                Ajustá tu <em>convocatoria</em>.
              </>
            ) : (
              <>
                Armá la <em>convocatoria</em>.
              </>
            )}
          </h1>
          <p className={styles.heroSub}>
            {editMode
              ? "Los cambios se notifican a quienes ya están unidos. La carta de la derecha se actualiza en vivo."
              : "Cuatro pasos cortos. La carta de la derecha se va armando con cada campo que completás."}
          </p>
        </div>
        <div className={styles.heroRight}>
          <span className={styles.heroProgressLabel}>
            Paso {activeStep + 1} de {STEPS.length}
          </span>
          <span className={styles.heroProgressValue}>
            {completedCount}/{STEPS.length} completos
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
            aria-label="Progreso del formulario"
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
                  <span className={styles.stepLabel}>{s.label}</span>
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
              <span className={styles.sectionLabel}>◆ Paso 1</span>
              <span className={styles.sectionTitle}>El juego</span>
            </header>

            <div className={styles.field} ref={searchRef}>
              <label className={styles.fieldLabel} htmlFor="mesa-game">
                Nombre del juego <span className={styles.required}>*</span>
              </label>
              {editMode ? (
                <div className={styles.readOnly}>{boardGameInput}</div>
              ) : (
                <>
                  <input
                    id="mesa-game"
                    type="text"
                    className={`${styles.input} ${bggData ? styles.inputSelected : ""}`}
                    value={boardGameInput}
                    onChange={handleGameInputChange}
                    onFocus={() =>
                      suggestions.length > 0 &&
                      !bggData &&
                      setShowDropdown(true)
                    }
                    placeholder="Buscá un juego en BGG…"
                    autoComplete="off"
                  />
                  {searching && (
                    <span className={styles.fieldHelp}>Buscando…</span>
                  )}
                  {noResults && !searching && (
                    <span className={styles.fieldHelp}>
                      Sin resultados en BGG
                    </span>
                  )}
                  {!searching && !noResults && !bggData && (
                    <span className={styles.fieldHelp}>
                      El mosaico y la imagen de la carta se generan a partir de
                      tu elección de BGG.
                    </span>
                  )}
                  {showDropdown && suggestions.length > 0 && (
                    <ul className={styles.suggestions}>
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
              <span className={styles.sectionLabel}>◆ Paso 2</span>
              <span className={styles.sectionTitle}>Cuándo</span>
            </header>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="mesa-date">
                Fecha y hora <span className={styles.required}>*</span>
              </label>
              <DateTimePicker
                id="mesa-date"
                name="date"
                value={date}
                onChange={setDate}
                required
              />
              <span className={styles.fieldHelp}>
                Recomendado: avisar con 24h+ de anticipación para llenar la
                mesa.
              </span>
            </div>
          </section>

          {/* Paso 3 · Dónde */}
          <section
            ref={(el) => (sectionRefs.current[2] = el)}
            id="mesa-form-section-donde"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>◆ Paso 3</span>
              <span className={styles.sectionTitle}>Dónde</span>
            </header>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Lugar <span className={styles.required}>*</span>
              </label>
              {user?.direccion?.texto?.trim() && (
                <button
                  type="button"
                  className={styles.btnMyLocation}
                  onClick={handleUseMyLocation}
                  title={`Usar mi dirección: ${user.direccion.texto}`}
                >
                  📍 Mi ubicación
                </button>
              )}
              <div className={styles.locationRow}>
                <PlaceAutocomplete
                  value={locationField.texto}
                  onChange={updateLocationTexto}
                  onSelect={handlePlaceSelect}
                  placeholder="Café Rivas · Palermo / Casa de Fede…"
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleManualGeocode}
                  disabled={geocoding}
                >
                  {geocoding ? "…" : "Buscar"}
                </button>
              </div>
              <span className={styles.fieldHelp}>
                Empezá a escribir y elegí una sugerencia, o tipeala y tocá
                "Buscar".
              </span>
            </div>
          </section>

          {/* Paso 4 · Detalles */}
          <section
            ref={(el) => (sectionRefs.current[3] = el)}
            id="mesa-form-section-detalles"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>◆ Paso 4</span>
              <span className={styles.sectionTitle}>Detalles</span>
            </header>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Jugadores totales (incluyéndote){" "}
                <span className={styles.required}>*</span>
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
                          ? `Ya hay ${playersCount} jugadores; no se puede bajar`
                          : undefined
                      }
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <span className={styles.fieldHelp}>
                {maxPlayers - 1}{" "}
                {maxPlayers - 1 === 1 ? "lugar libre" : "lugares libres"} para
                convocar.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Privacidad <span className={styles.required}>*</span>
              </label>
              <div className={styles.privacyOptions}>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${privacy === "public" ? styles.privacyCardActive : ""}`}
                  onClick={() => setPrivacy("public")}
                >
                  <GlobeIcon size={22} />
                  <div className={styles.privacyCardBody}>
                    <span className={styles.privacyCardTitle}>Pública</span>
                    <span className={styles.privacyCardSub}>
                      Cualquiera puede unirse mientras haya lugar.
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
                    <span className={styles.privacyCardTitle}>Amigos</span>
                    <span className={styles.privacyCardSub}>
                      Solo tus amigos la ven y se unen directo, sin aprobación.
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
                    <span className={styles.privacyCardTitle}>Privada</span>
                    <span className={styles.privacyCardSub}>
                      Aprobás vos cada solicitud antes de confirmar lugar.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="mesa-desc">
                Descripción (opcional)
              </label>
              <textarea
                id="mesa-desc"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿Qué tipo de partida es? ¿Apto principiantes? ¿Tono competitivo o relajado?"
                maxLength={500}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="mesa-rules">
                Reglas de la mesa (opcional)
              </label>
              <textarea
                id="mesa-rules"
                className={styles.textarea}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Llegar 10 min antes. Cada uno trae algo para picar. Sin alianzas. Apagamos celulares."
                maxLength={500}
                rows={3}
              />
            </div>
          </section>

          {/* Paso 5 · Tutoriales (opcional) */}
          <section
            ref={(el) => (sectionRefs.current[4] = el)}
            id="mesa-form-section-tutoriales"
            className={styles.section}
          >
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                ◆ Tutoriales (opcional)
              </span>
              <span className={styles.sectionRule} />
            </header>
            <p className={styles.sectionHelp}>
              ¿Querés sumar un tutorial de YouTube en la página de la mesa para
              los que no conocen el juego?
            </p>

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
                      No incluir tutoriales
                    </span>
                    <span className={styles.privacyCardSub}>
                      La sección no se muestra en la mesa.
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
                      Proponer un video
                    </span>
                    <span className={styles.privacyCardSub}>
                      Vos elegís el tutorial que mejor pega.
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
                      Buscar automáticamente
                    </span>
                    <span className={styles.privacyCardSub}>
                      Mostrar los 3 primeros resultados de YouTube para «Como
                      se juega {boardGameInput || "el juego"}».
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {tutorialMode === "manual" && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="mesa-tutorial-url">
                  URL del video de YouTube{" "}
                  <span className={styles.required}>*</span>
                </label>
                <input
                  id="mesa-tutorial-url"
                  type="url"
                  className={styles.input}
                  value={tutorialVideoInput}
                  onChange={(e) => setTutorialVideoInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  autoComplete="off"
                />
                {tutorialVideoInput.trim() && !tutorialVideoId && (
                  <span
                    className={styles.fieldHelp}
                    style={{ color: "var(--red)" }}
                  >
                    URL de YouTube inválido. Aceptamos youtube.com/watch?v=…,
                    youtu.be/…, /shorts/… o el ID directo.
                  </span>
                )}
                {tutorialVideoId && (
                  <span className={styles.fieldHelp}>
                    Video detectado · ID:{" "}
                    <code style={{ color: "var(--amber)" }}>
                      {tutorialVideoId}
                    </code>
                  </span>
                )}
              </div>
            )}
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
              {editMode ? "Descartar cambios" : "Cancelar"}
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!canSubmit || submitting}
            >
              {submitting
                ? "…"
                : editMode
                  ? "Guardar cambios →"
                  : "Publicar mesa →"}
            </button>
          </div>

          {editMode && onDelete && (
            <div className={styles.dangerZone}>
              <div className={styles.dangerLabel}>◆ Zona delicada</div>
              <div className={styles.dangerTitle}>Cancelar la mesa</div>
              <p className={styles.dangerSub}>
                Esta acción no se puede deshacer.{" "}
                {playersCount > 0
                  ? `Los ${playersCount} jugadores que ya se sumaron van a recibir una notificación.`
                  : "Si después se suman jugadores, no podrás revertir."}
              </p>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={onDelete}
                disabled={submitting}
              >
                <TrashIcon /> Cancelar mesa
              </button>
            </div>
          )}
        </form>

        <aside className={styles.preview}>
          <div className={styles.previewLabel}>
            ◆ Tu carta · vista previa en vivo
          </div>
          <div className={styles.previewCard} aria-hidden="true">
            <TableCard
              table={previewMesa}
              onUpdate={() => {}}
              onCancel={() => {}}
            />
          </div>
          <p className={styles.previewNote}>
            Así se ve tu mesa en el listado de la comunidad.
          </p>
        </aside>
      </div>
    </div>
  );
}
