import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './CreateTable.module.css';

const defaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d.toISOString().slice(0, 16);
};

export default function CreateTable() {
  const [form, setForm] = useState({
    date: defaultDate(),
    maxPlayers: 3,
    location: '',
    description: '',
    privacy: 'public',
  });
  const [boardGameInput, setBoardGameInput] = useState('');
  const [boardGameSelected, setBoardGameSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const abortRef = useRef(null);
  const searchCache = useRef(new Map());
  const navigate = useNavigate();

  useEffect(() => {
    if (boardGameInput.length < 3 || boardGameSelected) {
      setSuggestions([]);
      setShowDropdown(false);
      setSearching(false);
      setNoResults(false);
      return;
    }

    const q = boardGameInput.toLowerCase();

    const cached = searchCache.current.get(q);
    if (cached) {
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setNoResults(cached.length === 0);
      return;
    }

    setSearching(true);
    setNoResults(false);
    setShowDropdown(false);

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        const res = await axios.get(`/api/bgg/search?q=${encodeURIComponent(boardGameInput)}`, {
          signal: abortRef.current.signal,
        });
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
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [boardGameInput, boardGameSelected]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleGameInputChange = (e) => {
    setBoardGameInput(e.target.value);
    if (boardGameSelected) setBoardGameSelected(null);
  };

  const handleSelectGame = async (game) => {
    setShowDropdown(false);
    setSearching(true);
    try {
      const res = await axios.get(`/api/bgg/game/${game.id}`);
      setBoardGameSelected(res.data);
      setBoardGameInput(res.data.name);
    } catch {
      setBoardGameSelected({ name: game.name, id: game.id, thumbnail: null, year: game.year });
      setBoardGameInput(game.name);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!boardGameSelected) {
      setError('Seleccioná un juego del catálogo de BGG');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post('/api/tables', {
        ...form,
        boardGame: boardGameSelected.name,
        bggId: boardGameSelected.id,
        bggThumbnail: boardGameSelected.thumbnail,
        bggYear: boardGameSelected.year,
        maxPlayers: Number(form.maxPlayers),
      });
      navigate(`/mesas/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la mesa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ NUEVA MESA</div>
          <h1 className={styles.heroTitle}>Convocá una partida</h1>
          <p className={styles.heroSub}>Elegí juego, lugar y horario. La comunidad se encarga del resto.</p>
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
                  onFocus={() => suggestions.length > 0 && !boardGameSelected && setShowDropdown(true)}
                  className={`${styles.input} ${boardGameSelected ? styles.inputSelected : ''}`}
                  placeholder="Buscá un juego en BGG…"
                  autoComplete="off"
                />
                {searching && <div className={styles.searchHint}>Buscando…</div>}
                {noResults && <div className={styles.searchHint}>Sin resultados en BGG</div>}
                {showDropdown && (
                  <ul className={styles.suggestions}>
                    {suggestions.map((game) => (
                      <li
                        key={game.id}
                        className={styles.suggestionItem}
                        onMouseDown={() => handleSelectGame(game)}
                      >
                        {game.thumbnail
                          ? <img src={game.thumbnail} alt="" className={styles.suggestionThumb} />
                          : <div className={styles.suggestionThumbPlaceholder}>🎲</div>
                        }
                        <span className={styles.suggestionName}>{game.name}</span>
                        {game.year && <span className={styles.suggestionYear}>{game.year}</span>}
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
                    onClick={() => setForm((f) => ({ ...f, maxPlayers: Math.max(1, f.maxPlayers - 1) }))}
                  >−</button>
                  <span className={styles.counterVal}>{form.maxPlayers}</span>
                  <button
                    type="button"
                    className={styles.counterPlus}
                    onClick={() => setForm((f) => ({ ...f, maxPlayers: Math.min(20, f.maxPlayers + 1) }))}
                  >+</button>
                  <span className={styles.counterTotal}>Total: {Number(form.maxPlayers) + 1}</span>
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Ubicación</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                className={styles.input}
                placeholder="Casa, bar, club… (opcional)"
                maxLength={200}
              />
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
                  className={`${styles.privacyCard} ${form.privacy === 'public' ? styles.privacyCardSelected : ''}`}
                  onClick={() => setForm((f) => ({ ...f, privacy: 'public' }))}
                >
                  <span className={styles.privacyIcon}>🌐</span>
                  <span className={styles.privacyLabel}>Pública</span>
                  <span className={styles.privacyDesc}>Cualquiera puede unirse al instante</span>
                </button>
                <button
                  type="button"
                  className={`${styles.privacyCard} ${form.privacy === 'private' ? styles.privacyCardSelected : ''}`}
                  onClick={() => setForm((f) => ({ ...f, privacy: 'private' }))}
                >
                  <span className={styles.privacyIcon}>🔒</span>
                  <span className={styles.privacyLabel}>Privada</span>
                  <span className={styles.privacyDesc}>Aprobás cada solicitud</span>
                </button>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} onClick={() => navigate('/')}>
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Creando…' : '🎲 Crear mesa'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
