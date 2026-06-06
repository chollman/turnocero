import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Meeple from "../../components/shared/Meeple";
import { API } from "../../api/endpoints";
import MyGamesPicker from "./MyGamesPicker";
import LocationPicker from "./LocationPicker";
import PlayerPicker from "./PlayerPicker";
import PlayCard from "./PlayCard";
import PositionBadge from "./PositionBadge";
import useBggUserMap from "./useBggUserMap";
import usePlayDraft, { isDraftMeaningful } from "./usePlayDraft";
import { hasDisplayableScore } from "./playerScore";
import {
  computePlayerPositions,
  sortPlayersByScoreDesc,
} from "./playerPositions";
import bg from "./BgWatchProfile.module.css";
import styles from "./PlayForm.module.css";

// Trofeo inline (sin libs de iconos — convención del repo). Hereda currentColor.
function TrophyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const STEPS = [
  { key: "juego", label: "Juego" },
  { key: "jugadores", label: "Jugadores" },
  { key: "extras", label: "Extras" },
];

/**
 * Form de cargar / editar partida como página única con secciones (Juego /
 * Jugadores / Extras), estilo creador de mesas (MesaForm). NO se acopla a la
 * API — sólo expone onSubmit(payload) / onCancel() / onDelete().
 *
 * Props:
 *   user           usuario autenticado (jugador 1 por defecto + bggUsername).
 *   initialValues  { game, details, players } (para editar / juego prefijado).
 *   editMode       boolean → título/copys de edición, no autodetecta "Nuevo".
 *   lockedGame     boolean → juego read-only (edición o venido por ?juego).
 *   submitting     boolean.
 *   serverError    string.
 *   onSubmit       (payload) => Promise<void>
 *   onCancel       () => void
 *   onDelete       () => void (sólo edición → danger zone)
 */
export default function PlayForm({
  user,
  initialValues = {},
  editMode = false,
  lockedGame = false,
  submitting = false,
  serverError = "",
  onSubmit,
  onCancel,
  onDelete,
  keepGoing = false,
  onKeepGoingChange,
  lastJuntada = null,
}) {
  const bggUsername = user?.bggUsername;

  // Borrador local (#4): habilitado solo en un form de creación EN BLANCO (sin
  // ?juego ni roster heredado). El hook (load/save/clear) se declara acá arriba
  // para poder limpiar el borrador al cancelar/guardar.
  const draftEnabled =
    !editMode && !initialValues.game && !initialValues.players?.length;
  const { load: loadDraft, save: saveDraft, clear: clearDraft } = usePlayDraft(
    bggUsername,
  );

  // ── Exit animation (espejo de la entrada) ─────────────────────────────
  const [exiting, setExiting] = useState(false);
  const handleCancelClick = () => {
    if (submitting || exiting) return;
    if (draftEnabled) clearDraft();
    setExiting(true);
  };
  const handlePageAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName.includes("playFormExit") && exiting) onCancel?.();
  };

  // ── State ─────────────────────────────────────────────────────────────
  const [game, setGame] = useState(initialValues.game || null);
  const [details, setDetails] = useState(() => ({
    playdate: initialValues.details?.playdate || todayIso(),
    length: initialValues.details?.length ?? "",
    location: initialValues.details?.location || "",
    quantity: initialValues.details?.quantity || 1,
    comments: initialValues.details?.comments || "",
    incomplete: !!initialValues.details?.incomplete,
    nowinstats: !!initialValues.details?.nowinstats,
  }));
  const [players, setPlayers] = useState(() =>
    initialValues.players && initialValues.players.length > 0
      ? initialValues.players.map((p) => ({
          name: p.name || "",
          username: p.username || "",
          score: hasDisplayableScore(p.score) ? String(p.score) : "",
          win: !!p.win,
          new: !!p.new,
        }))
      : [
          {
            name: user?.displayName || user?.nombre || user?.username || "",
            username: user?.bggUsername || "",
            score: "",
            win: false,
            new: false,
          },
        ],
  );
  const [adding, setAdding] = useState(false);
  // Duración promedio del dueño para el juego elegido (sugerencia, #5b).
  const [suggestedDuration, setSuggestedDuration] = useState(null);

  const sectionRefs = {
    juego: useRef(null),
    jugadores: useRef(null),
    extras: useRef(null),
  };

  // Set estable de @BGG del roster (lowercase, dedup) — clave del effect de
  // autodetección. Solo cambia cuando cambia el conjunto de usernames, no el
  // flag `new` (así el setPlayers de abajo no re-dispara el effect → sin loop).
  const usernamesKey = useMemo(
    () =>
      [
        ...new Set(
          players.map((p) => p.username.trim().toLowerCase()).filter(Boolean),
        ),
      ]
        .sort()
        .join(","),
    [players],
  );

  // ── Autodetección "Nuevo" + duración sugerida (solo al crear) ─────────
  // Consulta `jugado` (local, sin pegarle a BGG) para CADA @BGG del roster.
  // Marca "Nuevo" solo con conocimiento positivo: `known && !played` (un
  // invitado sin partidas sincronizadas — known:false — no se marca, porque no
  // sabemos). La duración sugerida sale del promedio del dueño para ese juego.
  const detectRef = useRef(0);
  useEffect(() => {
    if (editMode || !game?.id) return undefined;
    const usernames = usernamesKey ? usernamesKey.split(",") : [];
    if (!usernames.length) {
      setSuggestedDuration(null);
      return undefined;
    }
    const owner = (user?.bggUsername || "").toLowerCase();
    const myId = ++detectRef.current;
    const ac = new AbortController();
    Promise.all(
      usernames.map((u) =>
        axios
          .get(API.bgg.JUGADO(u, game.id), { signal: ac.signal })
          .then(({ data }) => ({ u, ...data }))
          .catch(() => null),
      ),
    ).then((results) => {
      if (myId !== detectRef.current) return;
      const map = new Map();
      for (const r of results) if (r) map.set(r.u, r);
      setPlayers((arr) =>
        arr.map((p) => {
          const key = p.username.trim().toLowerCase();
          const r = key ? map.get(key) : null;
          return r ? { ...p, new: !!r.known && !r.played } : p;
        }),
      );
      const ownerRes = owner ? map.get(owner) : null;
      setSuggestedDuration(ownerRes?.avgDuration || null);
    });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, editMode, usernamesKey, user]);

  // ── Borrador local (#4): persistencia + oferta de retomar ─────────────
  // El hook y `draftEnabled` se declaran arriba (para limpiar al cancelar).
  const [draftOffer, setDraftOffer] = useState(null);

  // Al montar: ofrecer el borrador si tiene contenido (no auto-aplicar).
  useEffect(() => {
    if (!draftEnabled) return;
    const d = loadDraft();
    if (isDraftMeaningful(d)) setDraftOffer(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir el form en progreso. Salteamos el primer run para no pisar el
  // borrador ofrecido antes de que el usuario decida (en un form en blanco no
  // hay más renders hasta que interactúa, así que solo guarda cambios reales).
  const skipPersistRef = useRef(true);
  useEffect(() => {
    if (!draftEnabled) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    saveDraft({ game, details, players });
  }, [draftEnabled, game, details, players, saveDraft]);

  const restoreDraft = () => {
    if (!draftOffer) return;
    if (draftOffer.game) setGame(draftOffer.game);
    if (draftOffer.details)
      setDetails((d) => ({ ...d, ...draftOffer.details }));
    if (draftOffer.players?.length) setPlayers(draftOffer.players);
    setDraftOffer(null);
  };
  const discardDraft = () => {
    clearDraft();
    setDraftOffer(null);
  };

  // ── Players helpers ───────────────────────────────────────────────────
  const updatePlayer = (idx, key, val) =>
    setPlayers((arr) =>
      arr.map((p, i) => (i === idx ? { ...p, [key]: val } : p)),
    );
  const removePlayer = (idx) =>
    setPlayers((arr) => arr.filter((_, i) => i !== idx));
  const addPlayer = ({ name = "", username = "" } = {}) =>
    setPlayers((arr) => [
      ...arr,
      { name, username, score: "", win: false, new: false },
    ]);
  const updateDetail = (key, val) => setDetails((d) => ({ ...d, [key]: val }));

  // Atajo +/-: incrementa el score numéricamente (base 0 si no es número).
  const stepScore = (idx, delta) =>
    setPlayers((arr) =>
      arr.map((p, i) => {
        if (i !== idx) return p;
        const cur = Number(p.score);
        const base = p.score.trim() !== "" && Number.isFinite(cur) ? cur : 0;
        return { ...p, score: String(base + delta) };
      }),
    );

  const sortByScore = () => setPlayers((arr) => sortPlayersByScoreDesc(arr));

  // "Usar última juntada": reemplaza el roster + ubicación con los de la última
  // partida del usuario (sin score/win — juntada nueva). Solo al crear.
  const applyLastJuntada = () => {
    const roster = lastJuntada?.players || [];
    if (!roster.length) return;
    setPlayers(
      roster.map((p) => ({
        name: p.name || "",
        username: p.username || "",
        score: "",
        win: false,
        new: false,
      })),
    );
    if (lastJuntada.location) updateDetail("location", lastJuntada.location);
  };

  const showLastJuntada = !editMode && (lastJuntada?.players?.length || 0) > 0;

  // ── Derived ───────────────────────────────────────────────────────────
  const hasPlayers = players.some((p) => p.name.trim() || p.username.trim());
  // Posición derivada del puntaje (mayor = 1°, empates comparten). Sin scores
  // numéricos cae al orden del array (comportamiento histórico).
  const positions = computePlayerPositions(players);
  const canSortByScore =
    players.length > 1 && players.some((p) => hasDisplayableScore(p.score));
  // La fecha no puede ser futura. Se valida en JS (no con HTML required) +
  // gatea el submit; el `max` del input es solo para el datepicker.
  const dateInvalid = !!details.playdate && details.playdate > todayIso();

  const stepDone = {
    juego: !!game,
    jugadores: hasPlayers,
    extras: !!details.playdate && !dateInvalid,
  };
  const completedCount = Object.values(stepDone).filter(Boolean).length;
  const activeIdx = STEPS.findIndex((s) => !stepDone[s.key]);
  const activeStep = activeIdx === -1 ? STEPS.length - 1 : activeIdx;
  const canSubmit =
    stepDone.juego && stepDone.jugadores && stepDone.extras && !dateInvalid;

  // Jugadores cargados → payload, con la posición derivada del score. Lo usan
  // tanto el submit como la vista previa (una sola fuente).
  const buildPlayers = () => {
    const filtered = players.filter((p) => p.name.trim() || p.username.trim());
    const pos = computePlayerPositions(filtered);
    return filtered.map((p, i) => ({
      name: p.name.trim(),
      username: p.username.trim(),
      position: pos[i],
      score: p.score.trim(),
      win: p.win,
      new: p.new,
    }));
  };

  const goToStep = (key) =>
    sectionRefs[key].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    if (draftEnabled) clearDraft();
    onSubmit?.({
      objectid: game.id,
      playdate: details.playdate,
      length: details.length === "" ? null : Number(details.length),
      location: details.location,
      quantity: Number(details.quantity) || 1,
      comments: details.comments,
      incomplete: details.incomplete,
      nowinstats: details.nowinstats,
      players: buildPlayers(),
    });
  };

  // ── Preview play object (en vivo) ─────────────────────────────────────
  const previewPlay = {
    id: "preview",
    gameName: game?.name || "Elegí un juego",
    gameThumbnail: game?.thumbnail || null,
    date: details.playdate,
    location: details.location,
    duration: details.length === "" ? null : Number(details.length),
    quantity: Number(details.quantity) || 1,
    comments: details.comments,
    incomplete: details.incomplete,
    players: buildPlayers(),
  };
  // Avatares de los jugadores que son miembros de TurnoCero (por @BGG) en la
  // vista previa. Refetchea solo cuando cambia el set de usernames (no por tecla).
  const previewUserMap = useBggUserMap([previewPlay]);

  return (
    <div
      className={`${styles.page} ${exiting ? styles.pageExit : ""}`}
      onAnimationEnd={handlePageAnimationEnd}
    >
      <button
        type="button"
        className={styles.backBtn}
        onClick={handleCancelClick}
        disabled={submitting}
      >
        ← Volver
      </button>

      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}>
            <Meeple />
            BG WATCH
          </p>
          <h1 className={styles.heroTitle}>
            {editMode ? "Editar partida" : "Cargar partida"}
          </h1>
          <p className={styles.heroSub}>
            {editMode
              ? "Modificá los datos de tu partida. Se guardan también en BoardGameGeek."
              : "Registrá una partida en tu cuenta de BoardGameGeek: el juego, quiénes jugaron y los detalles."}
          </p>
        </div>
        <div className={styles.heroRight}>
          <span className={styles.heroProgressLabel}>
            Paso {activeStep + 1} de {STEPS.length}
          </span>
          <span className={styles.heroProgressValue}>
            {completedCount}/{STEPS.length}
          </span>
        </div>
      </header>

      {draftOffer && (
        <div className={styles.draftBanner} role="status">
          <span className={styles.draftText}>
            Tenés un borrador sin guardar de una partida.
          </span>
          <div className={styles.draftActions}>
            <button
              type="button"
              className={styles.draftRestore}
              onClick={restoreDraft}
            >
              Retomar
            </button>
            <button
              type="button"
              className={styles.draftDiscard}
              onClick={discardDraft}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={handleFormSubmit}>
          {/* Stepper */}
          <nav className={styles.steps} aria-label="Progreso">
            {STEPS.map((s, i) => {
              const done = stepDone[s.key] && i !== activeStep;
              const active = i === activeStep;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goToStep(s.key)}
                  className={`${styles.step} ${active ? styles.stepActive : ""} ${done ? styles.stepDone : ""}`}
                >
                  <span className={styles.stepDot}>{i + 1}</span>
                  <span className={styles.stepLabel}>{s.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Paso 1: Juego */}
          <section className={styles.section} ref={sectionRefs.juego}>
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                Paso 1
              </span>
              <span className={styles.sectionTitle}>El juego</span>
            </header>

            {game && (
              <div className={bg.gamePicked}>
                {game.thumbnail ? (
                  <img src={game.thumbnail} alt={game.name} />
                ) : (
                  <span className={bg.playThumbFallback}>🎲</span>
                )}
                <div>
                  <div className={bg.gamePickedName}>{game.name}</div>
                  {game.year && (
                    <div className={bg.gamePickedYear}>{game.year}</div>
                  )}
                </div>
                {!lockedGame && (
                  <button
                    type="button"
                    className={bg.gamePickedChange}
                    onClick={() => setGame(null)}
                  >
                    Cambiar
                  </button>
                )}
              </div>
            )}

            {!game && !lockedGame && (
              <MyGamesPicker
                bggUsername={bggUsername}
                onPick={(g) => setGame(g)}
              />
            )}
          </section>

          {/* Paso 2: Jugadores */}
          <section className={styles.section} ref={sectionRefs.jugadores}>
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                Paso 2
              </span>
              <span className={styles.sectionTitle}>Jugadores</span>
            </header>
            <p className={styles.sectionHelp}>
              Agregá los jugadores. La posición se calcula por el puntaje (o por
              el orden si no cargás puntajes).
            </p>

            {showLastJuntada && (
              <button
                type="button"
                className={styles.lastJuntadaBtn}
                onClick={applyLastJuntada}
                title={
                  lastJuntada.location
                    ? `Jugadores y ubicación (${lastJuntada.location}) de tu última partida`
                    : "Jugadores de tu última partida"
                }
              >
                ↺ Usar última juntada
                <span className={styles.lastJuntadaHint}>
                  {lastJuntada.players.length}{" "}
                  {lastJuntada.players.length === 1 ? "jugador" : "jugadores"}
                  {lastJuntada.location ? ` · ${lastJuntada.location}` : ""}
                </span>
              </button>
            )}

            <div className={bg.playerEditList}>
              {players.map((p, i) => (
                <div key={i} className={bg.playerEditRow}>
                  <PositionBadge position={positions[i]} />
                  <div className={bg.playerEditFields}>
                    <input
                      type="text"
                      className={bg.modalInput}
                      placeholder="Nombre"
                      value={p.name}
                      onChange={(e) => updatePlayer(i, "name", e.target.value)}
                      maxLength={100}
                    />
                    <div className={styles.scoreCell}>
                      <button
                        type="button"
                        className={styles.scoreStep}
                        onClick={() => stepScore(i, -1)}
                        aria-label="Bajar puntaje"
                        tabIndex={-1}
                      >
                        −
                      </button>
                      <input
                        type="text"
                        className={bg.modalInputSmall}
                        placeholder="Score"
                        value={p.score}
                        onChange={(e) =>
                          updatePlayer(i, "score", e.target.value)
                        }
                        maxLength={30}
                      />
                      <button
                        type="button"
                        className={styles.scoreStep}
                        onClick={() => stepScore(i, 1)}
                        aria-label="Subir puntaje"
                        tabIndex={-1}
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="text"
                      className={bg.modalInputSmall}
                      placeholder="@BGG (opcional)"
                      value={p.username}
                      onChange={(e) =>
                        updatePlayer(
                          i,
                          "username",
                          e.target.value.replace(/^@/, ""),
                        )
                      }
                      maxLength={50}
                    />
                    <button
                      type="button"
                      className={`${bg.iconToggle} ${p.win ? bg.iconToggleActive : ""}`}
                      onClick={() => updatePlayer(i, "win", !p.win)}
                      aria-label="Ganó"
                      aria-pressed={p.win}
                      title="Ganó"
                    >
                      <TrophyIcon />
                    </button>
                    {p.new && (
                      <span
                        className={bg.newBadge}
                        title="Primera vez que lo juega (autodetectado)"
                      >
                        ✨ Nuevo
                      </span>
                    )}
                  </div>
                  {players.length > 1 && (
                    <button
                      type="button"
                      className={bg.playerEditRemove}
                      onClick={() => removePlayer(i)}
                      aria-label="Eliminar jugador"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {adding ? (
              <PlayerPicker
                bggUsername={bggUsername}
                existing={players}
                onPick={(pl) => {
                  addPlayer(pl);
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <div className={styles.playerActions}>
                <button
                  type="button"
                  className={bg.btnGhost}
                  onClick={() => setAdding(true)}
                >
                  + Agregar jugador
                </button>
                {canSortByScore && (
                  <button
                    type="button"
                    className={styles.sortByScoreBtn}
                    onClick={sortByScore}
                  >
                    ↓ Ordenar por puntaje
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Paso 3: Extras */}
          <section className={styles.section} ref={sectionRefs.extras}>
            <header className={styles.sectionHead}>
              <span className={styles.sectionLabel}>
                <Meeple />
                Paso 3
              </span>
              <span className={styles.sectionTitle}>Extras</span>
            </header>

            <div className={bg.formGrid}>
              <div className={bg.field}>
                <label className={bg.fieldLabel}>Fecha</label>
                <input
                  type="date"
                  className={bg.modalInput}
                  value={details.playdate}
                  max={todayIso()}
                  onChange={(e) => updateDetail("playdate", e.target.value)}
                />
                {dateInvalid && (
                  <span className={styles.fieldError}>
                    La fecha no puede ser futura.
                  </span>
                )}
              </div>
              <div className={bg.field}>
                <label className={bg.fieldLabel}>Duración (min)</label>
                <input
                  type="number"
                  min={0}
                  className={bg.modalInput}
                  value={details.length}
                  onChange={(e) => updateDetail("length", e.target.value)}
                  placeholder="60"
                />
                {suggestedDuration && details.length === "" && (
                  <button
                    type="button"
                    className={styles.durationSuggest}
                    onClick={() =>
                      updateDetail("length", String(suggestedDuration))
                    }
                  >
                    Tu promedio: {suggestedDuration} min · usar
                  </button>
                )}
              </div>
              <div className={bg.field}>
                <label className={bg.fieldLabel}>Cantidad</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className={bg.modalInput}
                  value={details.quantity}
                  onChange={(e) => updateDetail("quantity", e.target.value)}
                />
              </div>
            </div>
            <div className={bg.field}>
              <label className={bg.fieldLabel}>Ubicación</label>
              <LocationPicker
                bggUsername={bggUsername}
                value={details.location}
                onPick={(loc) => updateDetail("location", loc)}
              />
            </div>
            <div className={bg.field}>
              <label className={bg.fieldLabel}>Comentarios</label>
              <textarea
                className={bg.modalTextarea}
                value={details.comments}
                onChange={(e) => updateDetail("comments", e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Cómo estuvo la partida, momentos memorables, etc."
              />
            </div>
            <div className={bg.checkboxRow}>
              <label className={bg.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={details.incomplete}
                  onChange={(e) => updateDetail("incomplete", e.target.checked)}
                />
                Incompleta (no se terminó)
              </label>
              <label className={bg.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={details.nowinstats}
                  onChange={(e) => updateDetail("nowinstats", e.target.checked)}
                />
                No contar para estadísticas
              </label>
            </div>
          </section>

          {serverError && <div className={styles.errorBox}>{serverError}</div>}

          {/* Multi-partida rápida (solo al crear): al guardar, conserva
              jugadores + ubicación + fecha y deja cargar la próxima. */}
          {onKeepGoingChange && (
            <label className={styles.keepGoing}>
              <input
                type="checkbox"
                checked={keepGoing}
                onChange={(e) => onKeepGoingChange(e.target.checked)}
              />
              Cargar otra partida después de ésta (conserva jugadores y
              ubicación)
            </label>
          )}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={handleCancelClick}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!canSubmit || submitting}
            >
              {submitting
                ? "Guardando…"
                : editMode
                  ? "Guardar cambios"
                  : keepGoing
                    ? "Guardar y cargar otra"
                    : "Guardar en BGG"}
            </button>
          </div>

          {editMode && onDelete && (
            <div className={styles.dangerZone}>
              <div className={styles.dangerLabel}>Zona de peligro</div>
              <div className={styles.dangerTitle}>Eliminar partida</div>
              <p className={styles.dangerSub}>
                Se borra la partida también en BoardGameGeek. Esta acción no se
                puede deshacer.
              </p>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={onDelete}
                disabled={submitting}
              >
                Eliminar partida
              </button>
            </div>
          )}
        </form>

        <aside className={styles.preview}>
          <div className={styles.previewLabel}>Vista previa</div>
          <div className={styles.previewCard}>
            <PlayCard play={previewPlay} userMap={previewUserMap} />
          </div>
          <p className={styles.previewNote}>Así se va a ver tu partida.</p>
        </aside>
      </div>
    </div>
  );
}
