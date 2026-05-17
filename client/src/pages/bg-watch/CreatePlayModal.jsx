import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ModalPortal from '../../components/shared/ModalPortal';
import styles from './BgWatchProfile.module.css';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function GameSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (q.trim().length < 3) { setResults([]); return; }
    timerRef.current = setTimeout(() => {
      setLoading(true);
      axios.get(`/api/bgg/search?q=${encodeURIComponent(q.trim())}`)
        .then(({ data }) => setResults(data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  return (
    <div className={styles.modalSection}>
      <input
        type="text"
        className={styles.modalInput}
        placeholder="Buscá un juego en BGG (≥3 caracteres)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {loading && <p className={styles.dimText}>Buscando…</p>}
      {!loading && q.length >= 3 && results.length === 0 && (
        <p className={styles.dimText}>Sin resultados.</p>
      )}
      <ul className={styles.gameSearchList}>
        {results.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={styles.gameSearchItem}
              onClick={() => onPick({ id: g.id, name: g.name, thumbnail: g.thumbnail, year: g.year })}
            >
              {g.thumbnail
                ? <img src={g.thumbnail} alt={g.name} className={styles.gameSearchThumb} />
                : <div className={styles.gameSearchThumbFallback}>🎲</div>
              }
              <div className={styles.gameSearchInfo}>
                <span className={styles.gameSearchName}>{g.name}</span>
                {g.year && <span className={styles.gameSearchYear}>{g.year}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepDetails({ details, setDetails }) {
  const update = (key, val) => setDetails((d) => ({ ...d, [key]: val }));
  return (
    <div className={styles.modalSection}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Fecha</label>
          <input
            type="date"
            className={styles.modalInput}
            value={details.playdate}
            onChange={(e) => update('playdate', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Duración (min)</label>
          <input
            type="number"
            min={0}
            className={styles.modalInput}
            value={details.length}
            onChange={(e) => update('length', e.target.value)}
            placeholder="60"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Ubicación</label>
          <input
            type="text"
            className={styles.modalInput}
            value={details.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="Casa, club, etc."
            maxLength={100}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Cantidad</label>
          <input
            type="number"
            min={1}
            max={99}
            className={styles.modalInput}
            value={details.quantity}
            onChange={(e) => update('quantity', e.target.value)}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Comentarios</label>
        <textarea
          className={styles.modalTextarea}
          value={details.comments}
          onChange={(e) => update('comments', e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Cómo estuvo la partida, momentos memorables, etc."
        />
      </div>
      <div className={styles.checkboxRow}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={details.incomplete}
            onChange={(e) => update('incomplete', e.target.checked)}
          />
          Incompleta (no se terminó)
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={details.nowinstats}
            onChange={(e) => update('nowinstats', e.target.checked)}
          />
          No contar para estadísticas
        </label>
      </div>
    </div>
  );
}

function StepPlayers({ players, setPlayers }) {
  const updatePlayer = (idx, key, val) => {
    setPlayers((arr) => arr.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  };
  const removePlayer = (idx) => setPlayers((arr) => arr.filter((_, i) => i !== idx));
  const addPlayer = () => setPlayers((arr) => [...arr, { name: '', username: '', color: '', score: '', win: false, new: false }]);

  return (
    <div className={styles.modalSection}>
      <p className={styles.dimText}>
        Agregá los jugadores. La posición se asigna por orden.
      </p>
      <div className={styles.playerEditList}>
        {players.map((p, i) => (
          <div key={i} className={styles.playerEditRow}>
            <span className={styles.playerEditPos}>{i + 1}</span>
            <div className={styles.playerEditFields}>
              <input
                type="text"
                className={styles.modalInput}
                placeholder="Nombre"
                value={p.name}
                onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                maxLength={100}
              />
              <input
                type="text"
                className={styles.modalInputSmall}
                placeholder="Color"
                value={p.color}
                onChange={(e) => updatePlayer(i, 'color', e.target.value)}
                maxLength={30}
              />
              <input
                type="text"
                className={styles.modalInputSmall}
                placeholder="Score"
                value={p.score}
                onChange={(e) => updatePlayer(i, 'score', e.target.value)}
                maxLength={30}
              />
              <input
                type="text"
                className={styles.modalInputSmall}
                placeholder="@BGG (opcional)"
                value={p.username}
                onChange={(e) => updatePlayer(i, 'username', e.target.value.replace(/^@/, ''))}
                maxLength={50}
              />
              <label className={styles.checkboxInline}>
                <input
                  type="checkbox"
                  checked={p.win}
                  onChange={(e) => updatePlayer(i, 'win', e.target.checked)}
                />
                Ganó
              </label>
              <label className={styles.checkboxInline}>
                <input
                  type="checkbox"
                  checked={p.new}
                  onChange={(e) => updatePlayer(i, 'new', e.target.checked)}
                />
                Nuevo
              </label>
            </div>
            {players.length > 1 && (
              <button
                type="button"
                className={styles.playerEditRemove}
                onClick={() => removePlayer(i)}
                aria-label="Eliminar jugador"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" className={styles.btnGhost} onClick={addPlayer}>
        + Agregar jugador
      </button>
    </div>
  );
}

export default function CreatePlayModal({ user, preselectedGame, editPlay, onClose, onCreated }) {
  const isEdit = !!editPlay;
  // In edit mode, game is locked (cannot be changed) and step 1 is skipped
  const initialGame = editPlay
    ? { id: editPlay.gameId, name: editPlay.gameName, thumbnail: editPlay.gameThumbnail }
    : (preselectedGame || null);
  const lockedGame = isEdit || !!preselectedGame;

  const [step, setStep] = useState(initialGame ? 2 : 1);
  const [game, setGame] = useState(initialGame);

  const [details, setDetails] = useState(() => editPlay
    ? {
        playdate: editPlay.date || todayIso(),
        length: editPlay.duration != null ? String(editPlay.duration) : '',
        location: editPlay.location || '',
        quantity: editPlay.quantity || 1,
        comments: editPlay.comments || '',
        incomplete: !!editPlay.incomplete,
        nowinstats: !!editPlay.nowinstats,
      }
    : {
        playdate: todayIso(),
        length: '',
        location: '',
        quantity: 1,
        comments: '',
        incomplete: false,
        nowinstats: false,
      }
  );

  const [players, setPlayers] = useState(() => {
    if (editPlay && Array.isArray(editPlay.players) && editPlay.players.length > 0) {
      return editPlay.players.map((p) => ({
        name: p.name || '',
        username: p.username || '',
        color: p.color || '',
        score: p.score != null ? String(p.score) : '',
        win: !!p.win,
        new: !!p.new,
      }));
    }
    return [{
      name: user?.displayName || user?.nombre || user?.username || '',
      username: user?.bggUsername || '',
      color: '',
      score: '',
      win: false,
      new: false,
    }];
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const body = {
        objectid: game.id,
        playdate: details.playdate,
        length: details.length === '' ? null : Number(details.length),
        location: details.location,
        quantity: Number(details.quantity) || 1,
        comments: details.comments,
        incomplete: details.incomplete,
        nowinstats: details.nowinstats,
        players: players
          .filter((p) => p.name.trim() || p.username.trim())
          .map((p, i) => ({
            name: p.name.trim(),
            username: p.username.trim(),
            position: i + 1,
            color: p.color.trim(),
            score: p.score.trim(),
            win: p.win,
            new: p.new,
          })),
      };
      if (isEdit) {
        await axios.put(`/api/bgg/partidas/${encodeURIComponent(editPlay.id)}`, body);
      } else {
        await axios.post('/api/bgg/partidas', body);
      }
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || (isEdit
        ? 'No se pudo editar la partida.'
        : 'No se pudo cargar la partida.'));
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = (step === 1 && game) || (step === 2);
  const canSubmit = step === 3 && players.some((p) => p.name.trim() || p.username.trim());

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={!submitting ? onClose : undefined}>
        <div
          className={`${styles.modalCard} ${styles.modalCardWide}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modalHeaderRow}>
            <h2 className={styles.modalTitle}>
              {isEdit ? 'Editar partida' : 'Cargar partida en BGG'}
            </h2>
            <button className={styles.modalClose} onClick={onClose} aria-label="Cerrar" disabled={submitting}>✕</button>
          </div>

          <div className={styles.stepIndicator}>
            {!lockedGame && (
              <span className={`${styles.step} ${step >= 1 ? styles.stepActive : ''}`}>1. Juego</span>
            )}
            <span className={`${styles.step} ${step >= 2 ? styles.stepActive : ''}`}>
              {lockedGame ? '1' : '2'}. Datos
            </span>
            <span className={`${styles.step} ${step >= 3 ? styles.stepActive : ''}`}>
              {lockedGame ? '2' : '3'}. Jugadores
            </span>
          </div>

          {game && (
            <div className={styles.gamePicked}>
              {game.thumbnail
                ? <img src={game.thumbnail} alt={game.name} />
                : <span className={styles.playThumbFallback}>🎲</span>
              }
              <div>
                <div className={styles.gamePickedName}>{game.name}</div>
                {game.year && <div className={styles.gamePickedYear}>{game.year}</div>}
              </div>
              {step !== 1 && !lockedGame && (
                <button
                  type="button"
                  className={styles.gamePickedChange}
                  onClick={() => setStep(1)}
                >
                  Cambiar
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <GameSearch onPick={(g) => { setGame(g); setStep(2); }} />
          )}
          {step === 2 && <StepDetails details={details} setDetails={setDetails} />}
          {step === 3 && <StepPlayers players={players} setPlayers={setPlayers} />}

          {error && <div className={styles.errorText}>{error}</div>}

          <div className={styles.modalActions}>
            {((step > 1 && !lockedGame) || (step > 2 && lockedGame)) && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setStep(step - 1)}
                disabled={submitting}
              >
                ← Atrás
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
              >
                Siguiente →
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Guardar en BGG')}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
