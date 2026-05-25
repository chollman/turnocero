import { useState, useEffect, useRef } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
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

export default function CreateTable() {
  const { user } = useAuth();
  const profileDireccionTexto = user?.direccion?.texto || "";
  const hasProfileDireccion = Boolean(
    profileDireccionTexto ||
    (user?.direccion?.lat != null && user?.direccion?.lng != null),
  );

  const [form, setForm] = useState({
    date: defaultDate(),
    maxPlayers: 3,
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
  const [searchParams] = useSearchParams();
  // Si la mesa se está creando desde el detalle de un evento, el query param
  // `?evento=<id>` se propaga al POST. El server valida permisos contra el
  // evento (canActInEvento). Sin el param, la mesa es global.
  const eventoId = searchParams.get("evento") || null;
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
  // aportado el mismo juego).
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
          if (!it.bggGameId || dedup.has(it.bggGameId)) continue;
          dedup.set(it.bggGameId, {
            id: it.bggGameId,
            name: it.gameName,
            thumbnail: it.thumbnail || null,
            image: it.image || null,
            year: it.year || null,
          });
        }
        setLudotecaGames(Array.from(dedup.values()));
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setLudotecaGames([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLudotecaLoading(false);
      });
    return () => ac.abort();
  }, [eventoId]);

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
        maxPlayers: Number(form.maxPlayers),
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
                  <div className={styles.ludotecaPickerHeader}>
                    <span className={styles.ludotecaPickerTitle}>
                      Ludoteca del evento
                    </span>
                    <span className={styles.ludotecaPickerHint}>
                      Tocá un juego para elegirlo, o buscá otro en BGG abajo.
                    </span>
                  </div>
                  <ul className={styles.ludotecaGrid}>
                    {ludotecaGames.map((g) => {
                      const isSelected =
                        boardGameSelected &&
                        Number(boardGameSelected.id) === Number(g.id);
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            className={`${styles.ludotecaItem} ${isSelected ? styles.ludotecaItemSelected : ""}`}
                            onClick={() => handlePickLudotecaGame(g)}
                            aria-pressed={isSelected || false}
                          >
                            {g.thumbnail || g.image ? (
                              <img
                                src={g.thumbnail || g.image}
                                alt=""
                                className={styles.ludotecaThumb}
                                loading="lazy"
                              />
                            ) : (
                              <div className={styles.ludotecaThumbFallback}>
                                🎲
                              </div>
                            )}
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
                    <label className={styles.label}>Hora *</label>
                    <input
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
                    <label className={styles.label}>Fecha y hora *</label>
                    <input
                      type="datetime-local"
                      name="date"
                      value={form.date}
                      onChange={handleChange}
                      className={styles.input}
                      required
                    />
                  </>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Lugares *
                  <span className={styles.labelHint}>(sin contar al host)</span>
                </label>
                <div className={styles.counter}>
                  <button
                    type="button"
                    className={styles.counterMinus}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        maxPlayers: Math.max(1, f.maxPlayers - 1),
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
                        maxPlayers: Math.min(20, f.maxPlayers + 1),
                      }))
                    }
                  >
                    +
                  </button>
                  <span className={styles.counterTotal}>
                    Total: {Number(form.maxPlayers) + 1}
                  </span>
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
                {form.location.lat != null && form.location.lng != null && (
                  <p className={styles.coordsHint}>
                    📍 {form.location.lat.toFixed(5)},{" "}
                    {form.location.lng.toFixed(5)}
                  </p>
                )}
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
