import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './CreateTable.module.css';

const POPULAR_GAMES = [
  'Catan', 'Carcassonne', 'Ticket to Ride', 'Pandemic', 'Terraforming Mars',
  '7 Wonders', 'Dominion', 'Agricola', 'Power Grid', 'Twilight Imperium',
  'Gloomhaven', 'Root', 'Spirit Island', 'Wingspan', 'Blood Rage',
];

const defaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d.toISOString().slice(0, 16);
};

export default function CreateTable() {
  const [form, setForm] = useState({
    boardGame: '',
    date: defaultDate(),
    maxPlayers: 3,
    location: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [bggResults, setBggResults] = useState([]);
  const [bggLoading, setBggLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchTimerRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleGameInputChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, boardGame: value }));

    clearTimeout(searchTimerRef.current);
    if (value.trim().length >= 2) {
      setBggLoading(true);
      searchTimerRef.current = setTimeout(() => searchBGG(value.trim()), 450);
    } else {
      setBggResults([]);
      setShowDropdown(false);
      setBggLoading(false);
    }
  };

  const searchBGG = async (query) => {
    const BGG = 'https://api.geekdo.com/xmlapi2';
    const parser = new DOMParser();
    try {
      const searchRes = await fetch(
        `${BGG}/search?query=${encodeURIComponent(query)}&type=boardgame`,
        { credentials: 'include', referrerPolicy: 'no-referrer' }
      );
      if (!searchRes.ok) throw new Error(`BGG ${searchRes.status}`);
      const searchDoc = parser.parseFromString(await searchRes.text(), 'text/xml');

      if (searchDoc.querySelector('message')) {
        setBggResults([]);
        setShowDropdown(false);
        return;
      }

      const items = Array.from(searchDoc.querySelectorAll('item[type="boardgame"]'))
        .slice(0, 12)
        .map((el) => ({
          id: el.getAttribute('id'),
          name: el.querySelector('name[type="primary"]')?.getAttribute('value') || '',
          year: el.querySelector('yearpublished')?.getAttribute('value') || null,
          thumbnail: null,
        }))
        .filter((g) => g.name);

      if (items.length > 0) {
        const ids = items.map((g) => g.id).join(',');
        try {
          const thingRes = await fetch(`${BGG}/thing?id=${ids}&type=boardgame`,
            { credentials: 'include', referrerPolicy: 'no-referrer' }
          );
          if (thingRes.ok) {
            const thingDoc = parser.parseFromString(await thingRes.text(), 'text/xml');
            thingDoc.querySelectorAll('item[type="boardgame"]').forEach((el) => {
              const id = el.getAttribute('id');
              let thumb = el.querySelector('thumbnail')?.textContent?.trim();
              if (thumb) {
                if (thumb.startsWith('//')) thumb = 'https:' + thumb;
                const game = items.find((g) => g.id === id);
                if (game) game.thumbnail = thumb;
              }
            });
          }
        } catch { /* thumbnails optional */ }
      }

      setBggResults(items);
      setShowDropdown(items.length > 0);
    } catch {
      setBggResults([]);
      setShowDropdown(false);
    } finally {
      setBggLoading(false);
    }
  };

  const handleBggSelect = (game) => {
    setForm((f) => ({ ...f, boardGame: game.name }));
    setBggResults([]);
    setShowDropdown(false);
  };

  const handleGameSelect = (game) => {
    setForm((f) => ({ ...f, boardGame: game }));
    setBggResults([]);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.boardGame.trim()) {
      setError('Ingresá el nombre del juego');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/tables', {
        ...form,
        maxPlayers: Number(form.maxPlayers),
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la mesa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.icon}>🎲</span>
            <h1 className={styles.title}>Nueva Mesa</h1>
            <p className={styles.sub}>Convocá jugadores para tu partida</p>
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Board game */}
            <div className={styles.field}>
              <label className={styles.label}>Juego de mesa *</label>
              <div className={styles.gameInputWrapper} ref={dropdownRef}>
                <input
                  type="text"
                  name="boardGame"
                  value={form.boardGame}
                  onChange={handleGameInputChange}
                  onFocus={() => bggResults.length > 0 && setShowDropdown(true)}
                  className={styles.input}
                  placeholder="¿Qué van a jugar?"
                  required
                  maxLength={100}
                  autoComplete="off"
                />
                {bggLoading && (
                  <span className={styles.searchingHint}>Buscando en BGG…</span>
                )}
                {showDropdown && bggResults.length > 0 && (
                  <div className={styles.dropdown}>
                    {bggResults.map((game) => (
                      <button
                        type="button"
                        key={game.id}
                        className={styles.dropdownItem}
                        onMouseDown={() => handleBggSelect(game)}
                      >
                        {game.thumbnail ? (
                          <img
                            src={game.thumbnail}
                            alt=""
                            className={styles.dropdownThumb}
                          />
                        ) : (
                          <span className={styles.dropdownThumbPlaceholder}>🎲</span>
                        )}
                        <span className={styles.dropdownName}>{game.name}</span>
                        {game.year && (
                          <span className={styles.dropdownYear}>{game.year}</span>
                        )}
                      </button>
                    ))}
                    <div className={styles.dropdownFooter}>BoardGameGeek</div>
                  </div>
                )}
              </div>
              <div className={styles.quickGames}>
                {POPULAR_GAMES.map((game) => (
                  <button
                    type="button"
                    key={game}
                    className={`${styles.gameChip} ${form.boardGame === game ? styles.selectedChip : ''}`}
                    onClick={() => handleGameSelect(game)}
                  >
                    {game}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & time */}
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

            {/* Max players */}
            <div className={styles.field}>
              <label className={styles.label}>
                Lugares disponibles *
                <span className={styles.hint}>
                  (cuántos jugadores más pueden unirse, sin contar al host)
                </span>
              </label>
              <div className={styles.counterRow}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => setForm((f) => ({ ...f, maxPlayers: Math.max(1, f.maxPlayers - 1) }))}
                >
                  −
                </button>
                <span className={styles.counterVal}>{form.maxPlayers}</span>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => setForm((f) => ({ ...f, maxPlayers: Math.min(20, f.maxPlayers + 1) }))}
                >
                  +
                </button>
                <span className={styles.totalPlayers}>
                  Total: {Number(form.maxPlayers) + 1} jugadores
                </span>
              </div>
            </div>

            {/* Location */}
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

            {/* Description */}
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

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => navigate('/')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? 'Creando…' : '¡Crear mesa!'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
