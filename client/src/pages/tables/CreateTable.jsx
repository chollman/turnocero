import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  return d.toISOString().slice(0, 16);
};

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
  const [searchParams] = useSearchParams();
  // Si la mesa se está creando desde el detalle de un evento, el query param
  // `?evento=<id>` se propaga al POST. El server valida permisos contra el
  // evento (canActInEvento). Sin el param, la mesa es global.
  const eventoId = searchParams.get("evento") || null;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!boardGameSelected) {
      setError("Seleccioná un juego del catálogo de BGG");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(API.tables.LIST, {
        ...form,
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
                  placeholder="Buscá un juego en BGG…"
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
                <label className={styles.label}>Fecha y hora *</label>
                <input
                  type="datetime-local"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  className={styles.input}
                  required
                />
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
                onClick={() => navigate("/")}
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
