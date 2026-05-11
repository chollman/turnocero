import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import styles from './CreateTable.module.css';

export default function EditTable() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boardGame, setBoardGame] = useState('');
  const [form, setForm] = useState(null);
  const [minPlayers, setMinPlayers] = useState(1);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [requestError, setRequestError] = useState('');
  const [requestLoading, setRequestLoading] = useState(null);

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
        setBoardGame(data.boardGame);
        setPendingRequests(data.pendingRequests || []);
        setForm({
          date: new Date(data.date).toISOString().slice(0, 16),
          maxPlayers: data.maxPlayers,
          location: data.location || '',
          description: data.description || '',
          privacy: data.privacy || 'public',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

  const handleRequest = async (userId, action) => {
    setRequestLoading(userId + action);
    setRequestError('');
    try {
      const { data } = await axios.post(`/api/tables/${id}/requests/${userId}/${action}`);
      setPendingRequests(data.pendingRequests || []);
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Error al procesar la solicitud');
    } finally {
      setRequestLoading(null);
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
              <label className={styles.label}>Juego de mesa</label>
              <p style={{ color: 'var(--amber)', fontFamily: 'var(--font-display)', fontSize: '1rem', margin: 0 }}>
                {boardGame}
              </p>
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

            {/* Privacy */}
            <div className={styles.field}>
              <label className={styles.label}>Privacidad de la mesa</label>
              <div className={styles.privacyToggle}>
                <button
                  type="button"
                  className={`${styles.privacyOption} ${form.privacy === 'public' ? styles.privacySelected : ''}`}
                  onClick={() => setForm((f) => ({ ...f, privacy: 'public' }))}
                >
                  <span className={styles.privacyIcon}>🌐</span>
                  <span className={styles.privacyLabel}>Pública</span>
                  <span className={styles.privacyDesc}>Cualquiera puede unirse</span>
                </button>
                <button
                  type="button"
                  className={`${styles.privacyOption} ${form.privacy === 'private' ? styles.privacySelected : ''}`}
                  onClick={() => setForm((f) => ({ ...f, privacy: 'private' }))}
                >
                  <span className={styles.privacyIcon}>🔒</span>
                  <span className={styles.privacyLabel}>Privada</span>
                  <span className={styles.privacyDesc}>El host acepta o rechaza</span>
                </button>
              </div>
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

          {/* Pending requests admin section */}
          {form.privacy === 'private' && (
            <div className={styles.requestsSection}>
              <h2 className={styles.requestsTitle}>
                Solicitudes pendientes
                {pendingRequests.length > 0 && (
                  <span className={styles.requestsBadge}>{pendingRequests.length}</span>
                )}
              </h2>

              {requestError && <div className={styles.errorBox}>{requestError}</div>}

              {pendingRequests.length === 0 ? (
                <p className={styles.requestsEmpty}>No hay solicitudes pendientes.</p>
              ) : (
                <ul className={styles.requestsList}>
                  {pendingRequests.map((req) => (
                    <li key={req._id} className={styles.requestItem}>
                      <span className={styles.requestAvatar}>{req.username[0].toUpperCase()}</span>
                      <span className={styles.requestUsername}>{req.username}</span>
                      <div className={styles.requestActions}>
                        <button
                          className={styles.btnAccept}
                          onClick={() => handleRequest(req._id, 'accept')}
                          disabled={requestLoading !== null}
                        >
                          {requestLoading === req._id + 'accept' ? '…' : 'Aceptar'}
                        </button>
                        <button
                          className={styles.btnReject}
                          onClick={() => handleRequest(req._id, 'reject')}
                          disabled={requestLoading !== null}
                        >
                          {requestLoading === req._id + 'reject' ? '…' : 'Rechazar'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
