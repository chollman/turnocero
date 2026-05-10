import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import styles from './CreateTable.module.css';

const POPULAR_GAMES = [
  'Catan', 'Carcassonne', 'Ticket to Ride', 'Pandemic', 'Terraforming Mars',
  '7 Wonders', 'Dominion', 'Agricola', 'Power Grid', 'Twilight Imperium',
  'Gloomhaven', 'Root', 'Spirit Island', 'Wingspan', 'Blood Rage',
];

export default function EditTable() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [minPlayers, setMinPlayers] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchTable = async () => {
      try {
        const { data } = await axios.get(`/api/tables/${id}`);
        const isHost =
          data.host._id === user._id ||
          data.host._id?.toString() === user._id?.toString();
        if (!isHost || data.status === 'cancelled') {
          navigate('/');
          return;
        }
        setMinPlayers(data.players.length);
        setForm({
          boardGame: data.boardGame,
          date: new Date(data.date).toISOString().slice(0, 16),
          maxPlayers: data.maxPlayers,
          location: data.location || '',
          description: data.description || '',
        });
      } catch {
        navigate('/');
      } finally {
        setFetching(false);
      }
    };
    fetchTable();
  }, [id, user._id, navigate]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleGameSelect = (game) =>
    setForm((f) => ({ ...f, boardGame: game }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.boardGame.trim()) {
      setError('Ingresá el nombre del juego');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`/api/tables/${id}`, {
        ...form,
        maxPlayers: Number(form.maxPlayers),
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setLoading(false);
    }
  };

  if (fetching || !form) return null;

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.icon}>✏️</span>
            <h1 className={styles.title}>Editar Mesa</h1>
            <p className={styles.sub}>Modificá los detalles de tu partida</p>
          </div>

          {error && <div className={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Juego de mesa *</label>
              <input
                type="text"
                name="boardGame"
                value={form.boardGame}
                onChange={handleChange}
                className={styles.input}
                placeholder="¿Qué van a jugar?"
                required
                maxLength={100}
              />
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
                Lugares disponibles *
                <span className={styles.hint}>
                  (cuántos jugadores más pueden unirse, sin contar al host)
                </span>
              </label>
              <div className={styles.counterRow}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() =>
                    setForm((f) => ({ ...f, maxPlayers: Math.max(minPlayers, f.maxPlayers - 1) }))
                  }
                >
                  −
                </button>
                <span className={styles.counterVal}>{form.maxPlayers}</span>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() =>
                    setForm((f) => ({ ...f, maxPlayers: Math.min(20, f.maxPlayers + 1) }))
                  }
                >
                  +
                </button>
                <span className={styles.totalPlayers}>
                  Total: {Number(form.maxPlayers) + 1} jugadores
                </span>
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
                {loading ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
