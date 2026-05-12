import { useState } from 'react';
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
    privacy: 'public',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.boardGame.trim()) {
      setError('Ingresá el nombre del juego');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/tables', { ...form, maxPlayers: Number(form.maxPlayers) });
      navigate('/');
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
                    className={`${styles.gameChip} ${form.boardGame === game ? styles.gameChipSelected : ''}`}
                    onClick={() => setForm((f) => ({ ...f, boardGame: game }))}
                  >
                    {game}
                  </button>
                ))}
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
