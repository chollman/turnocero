import { useState, useEffect, useRef } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
import InfoTooltip from "../../components/shared/InfoTooltip";
import DateTimePicker from "../../components/shared/DateTimePicker";
import MesaForm from "./MesaForm";
import styles from "./CreateTable.module.css";

const defaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return toLocalDatetimeInput(d);
};

// `datetime-local` y `time` inputs esperan strings en LOCAL time (no UTC).
// `.toISOString()` aplica timezone shift, así que armamos el string a mano.
function toLocalDatetimeInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toLocalTimeInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Dispatcher: el flow standalone (sin eventoId) usa el wizard `<MesaForm>`
// nuevo (handoff-driven, 4 pasos + live preview). El flow "mesa dentro de
// un evento" mantiene su layout compacto — tiene constraints distintas
// (fecha forzada por el evento, ludoteca picker, sin location porque se
// hereda) que no encajan en el wizard.
export default function CreateTable() {
  const [searchParams] = useSearchParams();
  const eventoId = searchParams.get("evento") || null;
  if (eventoId) return <CreateMesaForEvento eventoId={eventoId} />;
  return <CreateMesaStandalone />;
}

// ── Standalone (wizard) ──────────────────────────────────────────────
function CreateMesaStandalone() {
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const goBack = () => {
    const canGoBack = (window.history.state?.idx ?? 0) > 0;
    if (canGoBack) navigate(-1);
    else navigate("/mesas");
  };

  const handleSubmit = async (payload) => {
    setServerError("");
    setSubmitting(true);
    try {
      const { data } = await axios.post(API.tables.LIST, {
        boardGame: payload.boardGame,
        bggId: payload.bggId,
        bggThumbnail: payload.bggThumbnail,
        bggImage: payload.bggImage,
        bggYear: payload.bggYear,
        date: payload.date,
        // UI cuenta al host; el server espera "spots libres" → restamos 1.
        maxPlayers: Math.max(1, Number(payload.maxPlayers) - 1),
        location: payload.location,
        description: payload.description,
        rules: payload.rules,
        tags: payload.tags,
        privacy: payload.privacy,
        tutorialMode: payload.tutorialMode,
        tutorialVideoId: payload.tutorialVideoId,
        bgaUrl: payload.bgaUrl,
      });
      navigate(`/mesas/${data._id}`);
    } catch (err) {
      const msg = err.response?.data?.message || "Error al crear la mesa";
      setServerError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MesaForm
      editMode={false}
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={goBack}
    />
  );
}

// ── Mesa dentro de un evento (compact form) ──────────────────────────
function CreateMesaForEvento({ eventoId: _eventoId }) {
  const { user } = useAuth();
  const profileDireccionTexto = user?.direccion?.texto || "";
  const hasProfileDireccion = Boolean(
    profileDireccionTexto ||
    (user?.direccion?.lat != null && user?.direccion?.lng != null),
  );

  // `maxPlayers` en el form representa el TOTAL de jugadores incluyendo al
  // host (más intuitivo para el usuario). Antes de mandarlo al server le
  // restamos 1, porque el server lo modela como "spots libres aparte del host".
  const [form, setForm] = useState({
    date: defaultDate(),
    maxPlayers: 4,
    location: { texto: "", lat: null, lng: null },
    description: "",
    privacy: "public",
  });
  const [geocoding, setGeocoding] = useState(false);
  const [boardGameInput, setBoardGameInput] = useState("");
  const debouncedBoardGameInput = useDebouncedValue(boardGameInput, 400);
  const [boardGameSelected, setBoardGameSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const abortRef = useRef(null);
  const searchCache = useRef(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  // `eventoId` ahora viene como prop desde el dispatcher (CreateTable arriba).
  // Antes lo leíamos del searchParam acá adentro, pero al haber un dispatcher
  // que ya decidió este branch del flow, es más claro recibirlo como input.
  const eventoId = _eventoId;
  // EventoMesas pasa `eventDate` por navigation state al hacer "Crear mesa"
  // para no tener que refetchear el evento acá. Si el user refresca el form
  // (state se pierde), caemos a un fetch defensivo abajo.
  const [eventDate, setEventDate] = useState(
    () => location.state?.eventDate || null,
  );
  // Hora elegida por el user para el día del evento (HH:MM). Default = la hora
  // misma del evento, fallback 18:00.
  const [timeOfDay, setTimeOfDay] = useState("18:00");
  // Ludoteca del evento (sólo cuando hay `eventoId`). Cada user puede haber
  // sumado el mismo bggGameId; deduplicamos para el picker.
  const [ludotecaGames, setLudotecaGames] = useState([]);
  const [ludotecaLoading, setLudotecaLoading] = useState(false);
  // Acordeón colapsado por default — el grid de juegos puede ocupar bastante
  // pantalla, especialmente en eventos con ludotecas grandes; el usuario lo
  // abre cuando quiere elegir.
  const [ludotecaExpanded, setLudotecaExpanded] = useState(false);

  // Si el form se carga con ?evento= pero sin state (refresh / link directo),
  // fetcheamos el evento para conocer su fecha.
  useEffect(() => {
    if (!eventoId || eventDate) return undefined;
    const ac = new AbortController();
    axios
      .get(API.eventos.DETAIL(eventoId), { signal: ac.signal })
      .then(({ data }) => {
        if (ac.signal.aborted) return;
        if (data?.eventDate) setEventDate(data.eventDate);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [eventoId, eventDate]);

  // Fetch de la ludoteca para mostrar el picker de juegos ya cargados al
  // evento. Si la ludoteca tiene juegos, el host puede elegir de ahí en vez
  // de buscar en BGG. Deduplicamos por bggGameId (varios users pueden haber
  // aportado el mismo juego); marcamos `addedByMe=true` si el user actual
  // está entre los aportantes para ordenar y diferenciar visualmente.
  const myUserId = user?._id ? String(user._id) : null;
  useEffect(() => {
    if (!eventoId) return undefined;
    const ac = new AbortController();
    setLudotecaLoading(true);
    axios
      .get(API.eventos.LUDOTECA(eventoId), { signal: ac.signal })
      .then(({ data }) => {
        if (ac.signal.aborted) return;
        const items = data?.items || [];
        const dedup = new Map();
        for (const it of items) {
          if (!it.bggGameId) continue;
          const addedById = String(it.addedBy?._id || it.addedBy || "");
          const isMine = myUserId && addedById === myUserId;
          const existing = dedup.get(it.bggGameId);
          if (existing) {
            // Si ya estaba pero ahora aparece otra aportación mía, lo marcamos.
            if (isMine) existing.addedByMe = true;
            continue;
          }
          dedup.set(it.bggGameId, {
            id: it.bggGameId,
            name: it.gameName,
            thumbnail: it.thumbnail || null,
            image: it.image || null,
            year: it.year || null,
            addedByMe: !!isMine,
          });
        }
        // Sort: primero los míos, después los demás. Dentro de cada grupo
        // mantenemos el orden de aparición (Map preserva insertion order).
        const all = Array.from(dedup.values());
        const mine = all.filter((g) => g.addedByMe);
        const others = all.filter((g) => !g.addedByMe);
        setLudotecaGames([...mine, ...others]);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setLudotecaGames([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLudotecaLoading(false);
      });
    return () => ac.abort();
  }, [eventoId, myUserId]);

  // Cuando llega `eventDate`, seedeamos el time picker con la hora del evento.
  useEffect(() => {
    if (!eventDate) return;
    const d = new Date(eventDate);
    if (!Number.isNaN(d.getTime())) setTimeOfDay(toLocalTimeInput(d));
  }, [eventDate]);

  useEffect(() => {
    if (debouncedBoardGameInput.length < 3 || boardGameSelected) {
      setSuggestions([]);
      setShowDropdown(false);
      setSearching(false);
      setNoResults(false);
      return;
    }

    const q = debouncedBoardGameInput.toLowerCase();

    const cached = searchCache.current.get(q);
    if (cached) {
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setNoResults(cached.length === 0);
      setSearching(false);
      return;
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
          params: { q: debouncedBoardGameInput },
          signal,
        });
        if (signal.aborted) return;
        searchCache.current.set(q, res.data);
        setSuggestions(res.data);
        if (res.data.length > 0) {
          setShowDropdown(true);
        } else {
          setNoResults(true);
        }
      } catch (err) {
        if (!axios.isCancel(err)) setSuggestions([]);
      } finally {
        if (!signal.aborted) setSearching(false);
      }
    })();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [debouncedBoardGameInput, boardGameSelected]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // ── Ubicación ──
  // El mapa se removió de la creación para simplificar el flujo. Si el usuario
  // no completa, el server fallbackea a `user.direccion` (si la tiene). Para
  // ajuste fino post-creación, el host puede editar la mesa.
  const updateLocationTexto = (texto) =>
    setForm((f) => ({ ...f, location: { ...f.location, texto } }));
  const handlePlaceSelect = ({ lat, lng, formattedAddress }) =>
    setForm((f) => ({
      ...f,
      location: { texto: formattedAddress || f.location.texto, lat, lng },
    }));
  const handleManualGeocode = async () => {
    const q = form.location.texto.trim();
    if (q.length < 3) {
      setError("Escribí una dirección de al menos 3 caracteres.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await axios.get(API.geocode, { params: { q } });
      setForm((f) => ({
        ...f,
        location: {
          texto: data.formatted || f.location.texto,
          lat: data.lat,
          lng: data.lng,
        },
      }));
    } catch (err) {
      const msg =
        err.response?.status === 404
          ? "No se encontró la dirección. Intentá ser más específico o picá una sugerencia."
          : err.response?.data?.message || "Error al buscar la dirección.";
      setError(msg);
      setTimeout(() => setError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  const handleGameInputChange = (e) => {
    setBoardGameInput(e.target.value);
    if (boardGameSelected) setBoardGameSelected(null);
  };

  const handleSelectGame = async (game) => {
    setShowDropdown(false);
    setSearching(true);
    try {
      const res = await axios.get(API.bgg.GAME(game.id));
      setBoardGameSelected(res.data);
      setBoardGameInput(res.data.name);
    } catch {
      setBoardGameSelected({
        name: game.name,
        id: game.id,
        thumbnail: null,
        image: null,
        year: game.year,
      });
      setBoardGameInput(game.name);
    } finally {
      setSearching(false);
    }
  };

  // Pick directo desde la ludoteca: el server ya hidrató name/thumbnail/image/year
  // al persistir el item, así que no hace falta golpear BGG de nuevo.
  const handlePickLudotecaGame = (game) => {
    setBoardGameSelected({
      id: game.id,
      name: game.name,
      thumbnail: game.thumbnail,
      image: game.image,
      year: game.year,
    });
    setBoardGameInput(game.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!boardGameSelected) {
      setError("Seleccioná un juego del catálogo de BGG");
      return;
    }
    setLoading(true);
    try {
      // Si la mesa va dentro de un evento, NO mandamos location: el server la
      // hereda del evento (single source of truth). Sacarlo del payload evita
      // que el server caiga al fallback "user.direccion" si el form viniera
      // con location vacía.
      const { location: _location, date: formDate, ...rest } = form;
      const basePayload = eventoId ? rest : form;
      // Dentro de un evento, el día se fuerza al del evento y el user solo
      // edita la hora. Si todavía no llegó `eventDate`, mandamos el formDate
      // como estaba — el server hace el override defensivo de todas formas.
      let dateToSend = formDate;
      if (eventoId && eventDate) {
        const base = new Date(eventDate);
        const [h, m] = (timeOfDay || "00:00").split(":").map(Number);
        base.setHours(h || 0, m || 0, 0, 0);
        dateToSend = toLocalDatetimeInput(base);
      }
      const { data } = await axios.post(API.tables.LIST, {
        ...basePayload,
        date: dateToSend,
        boardGame: boardGameSelected.name,
        bggId: boardGameSelected.id,
        bggThumbnail: boardGameSelected.thumbnail,
        bggImage: boardGameSelected.image,
        bggYear: boardGameSelected.year,
        // UI cuenta al host; el server espera "spots libres" → restamos 1.
        maxPlayers: Number(form.maxPlayers) - 1,
        // Sólo se incluye si veníamos desde /eventos/:id/mesas con ?evento=
        ...(eventoId ? { eventoId } : {}),
      });
      navigate(`/mesas/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Error al crear la mesa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            ◆ NUEVA MESA{eventoId ? " · DENTRO DEL EVENTO" : ""}
          </div>
          <h1 className={styles.heroTitle}>
            {eventoId ? "Armá una mesa para el evento" : "Convocá una partida"}
          </h1>
          <p className={styles.heroSub}>
            {eventoId
              ? "La mesa va a ser visible dentro del evento, no en /mesas global."
              : "Elegí juego, lugar y horario. La comunidad se encarga del resto."}
          </p>
        </div>

        <div className={styles.formCard}>
          {error && <div className={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Juego de mesa *</label>
              {eventoId && ludotecaGames.length > 0 && (
                <div className={styles.ludotecaPicker}>
                  {/* Header acts as a button (role+keyboard) en vez de
                      <button> nativo para poder anidar el InfoTooltip
                      (que también es <button>) sin invalidar el HTML. */}
                  <div
                    className={styles.ludotecaPickerHeader}
                    role="button"
                    tabIndex={0}
                    onClick={() => setLudotecaExpanded((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLudotecaExpanded((v) => !v);
                      }
                    }}
                    aria-expanded={ludotecaExpanded}
                    aria-controls="ludoteca-picker-grid"
                  >
                    <span className={styles.ludotecaPickerTitleRow}>
                      <span className={styles.ludotecaPickerTitle}>
                        Ludoteca del evento
                      </span>
                      <span className={styles.ludotecaPickerCount}>
                        {ludotecaGames.length}{" "}
                        {ludotecaGames.length === 1 ? "juego" : "juegos"}
                      </span>
                      {/* stopPropagation evita que el click/keydown del
                          tooltip toggle-é el acordeón. */}
                      <span
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <InfoTooltip label="Cómo usar la ludoteca">
                          Tocá un juego de la ludoteca para elegirlo, o buscá
                          otro en BGG abajo.
                        </InfoTooltip>
                      </span>
                      <span
                        className={`${styles.ludotecaPickerCaret} ${ludotecaExpanded ? styles.ludotecaPickerCaretOpen : ""}`}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </span>
                  </div>
                  <div
                    className={`${styles.ludotecaCollapse} ${ludotecaExpanded ? styles.ludotecaCollapseOpen : ""}`}
                    aria-hidden={!ludotecaExpanded}
                  >
                    <div className={styles.ludotecaCollapseInner}>
                      <ul
                        id="ludoteca-picker-grid"
                        className={styles.ludotecaGrid}
                      >
                        {ludotecaGames.map((g) => {
                          const isSelected =
                            boardGameSelected &&
                            Number(boardGameSelected.id) === Number(g.id);
                          return (
                            <li key={g.id}>
                              <button
                                type="button"
                                className={`${styles.ludotecaItem} ${isSelected ? styles.ludotecaItemSelected : ""} ${g.addedByMe ? styles.ludotecaItemMine : ""}`}
                                onClick={() => handlePickLudotecaGame(g)}
                                aria-pressed={isSelected || false}
                                aria-label={
                                  g.addedByMe
                                    ? `${g.name} (aportado por vos)`
                                    : g.name
                                }
                                tabIndex={ludotecaExpanded ? 0 : -1}
                              >
                                <div className={styles.ludotecaThumbWrap}>
                                  {g.image || g.thumbnail ? (
                                    <img
                                      src={g.image || g.thumbnail}
                                      alt=""
                                      className={styles.ludotecaThumb}
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div
                                      className={styles.ludotecaThumbFallback}
                                    >
                                      🎲
                                    </div>
                                  )}
                                  {g.addedByMe && (
                                    <span
                                      className={styles.ludotecaMineBadge}
                                      aria-hidden="true"
                                    >
                                      Tuyo
                                    </span>
                                  )}
                                </div>
                                <span className={styles.ludotecaName}>
                                  {g.name}
                                </span>
                                {g.year && (
                                  <span className={styles.ludotecaYear}>
                                    {g.year}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              {eventoId && ludotecaLoading && ludotecaGames.length === 0 && (
                <div className={styles.searchHint}>Cargando ludoteca…</div>
              )}
              <div className={styles.gameSearchWrapper} ref={searchRef}>
                <input
                  type="text"
                  value={boardGameInput}
                  onChange={handleGameInputChange}
                  onFocus={() =>
                    suggestions.length > 0 &&
                    !boardGameSelected &&
                    setShowDropdown(true)
                  }
                  className={`${styles.input} ${boardGameSelected ? styles.inputSelected : ""}`}
                  placeholder={
                    eventoId && ludotecaGames.length > 0
                      ? "…o buscá otro juego en BGG"
                      : "Buscá un juego en BGG…"
                  }
                  autoComplete="off"
                />
                {searching && (
                  <div className={styles.searchHint}>Buscando…</div>
                )}
                {noResults && (
                  <div className={styles.searchHint}>Sin resultados en BGG</div>
                )}
                {showDropdown && (
                  <ul className={styles.suggestions}>
                    {suggestions.map((game) => (
                      <li
                        key={game.id}
                        className={styles.suggestionItem}
                        onMouseDown={() => handleSelectGame(game)}
                      >
                        {game.thumbnail ? (
                          <img
                            src={game.thumbnail}
                            alt=""
                            className={styles.suggestionThumb}
                          />
                        ) : (
                          <div className={styles.suggestionThumbPlaceholder}>
                            🎲
                          </div>
                        )}
                        <span className={styles.suggestionName}>
                          {game.name}
                        </span>
                        {game.year && (
                          <span className={styles.suggestionYear}>
                            {game.year}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.field}>
                {eventoId ? (
                  <>
                    <label className={styles.label} htmlFor="mesa-time">
                      Hora *
                    </label>
                    <input
                      id="mesa-time"
                      type="time"
                      name="time"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className={styles.input}
                      required
                    />
                  </>
                ) : (
                  <>
                    <label className={styles.label} htmlFor="mesa-date">
                      Fecha y hora *
                    </label>
                    <DateTimePicker
                      id="mesa-date"
                      name="date"
                      value={form.date}
                      onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                      required
                    />
                  </>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Jugadores
                  <span className={styles.labelHint}>(incluyéndote)</span>
                </label>
                <div className={styles.counter}>
                  <button
                    type="button"
                    className={styles.counterMinus}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        maxPlayers: Math.max(2, f.maxPlayers - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <span className={styles.counterVal}>{form.maxPlayers}</span>
                  <button
                    type="button"
                    className={styles.counterPlus}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        maxPlayers: Math.min(21, f.maxPlayers + 1),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {!eventoId && (
              <div className={styles.field}>
                <label className={styles.label}>
                  Ubicación
                  <span className={styles.labelHint}>(opcional)</span>
                </label>
                <p className={styles.locationHint}>
                  {hasProfileDireccion ? (
                    <>
                      Si lo dejás vacío, usamos la dirección de tu perfil:{" "}
                      <strong>
                        {profileDireccionTexto || "tus coordenadas guardadas"}
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      Si lo dejás vacío, la mesa se publica sin ubicación.{" "}
                      <Link to="/perfil" className={styles.locationLink}>
                        Agregá una dirección a tu perfil
                      </Link>{" "}
                      para usarla por default.
                    </>
                  )}
                </p>
                <div className={styles.geocodeRow}>
                  <PlaceAutocomplete
                    value={form.location.texto}
                    onChange={updateLocationTexto}
                    onSelect={handlePlaceSelect}
                    placeholder="Empezá a escribir una dirección…"
                  />
                  <button
                    type="button"
                    className={styles.btnSearch}
                    onClick={handleManualGeocode}
                    disabled={geocoding}
                    title="Buscar la dirección que tipeaste (sin picar sugerencia)"
                  >
                    {geocoding ? "…" : "Buscar"}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Descripción</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Reglas especiales, nivel requerido, qué llevar… (opcional)"
                maxLength={500}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Privacidad</label>
              <div className={styles.privacyGrid}>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${form.privacy === "public" ? styles.privacyCardSelected : ""}`}
                  onClick={() => setForm((f) => ({ ...f, privacy: "public" }))}
                >
                  <span className={styles.privacyIcon}>🌐</span>
                  <span className={styles.privacyLabel}>Pública</span>
                  <span className={styles.privacyDesc}>
                    Cualquiera puede unirse al instante
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${form.privacy === "private" ? styles.privacyCardSelected : ""}`}
                  onClick={() => setForm((f) => ({ ...f, privacy: "private" }))}
                >
                  <span className={styles.privacyIcon}>🔒</span>
                  <span className={styles.privacyLabel}>Privada</span>
                  <span className={styles.privacyDesc}>
                    Aprobás cada solicitud
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  // Volvemos a la pantalla previa si hay historial in-app
                  // (React Router trackea su stack con `idx`). Si no, caemos
                  // al evento (cuando vinimos con ?evento=) o a Home.
                  const canGoBack = (window.history.state?.idx ?? 0) > 0;
                  if (canGoBack) navigate(-1);
                  else if (eventoId) navigate(`/eventos/${eventoId}?tab=mesas`);
                  else navigate("/");
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={loading}
              >
                {loading ? "Creando…" : "🎲 Crear mesa"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
