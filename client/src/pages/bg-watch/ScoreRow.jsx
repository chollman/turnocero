import Avatar from "../../components/shared/Avatar";
import { hasDisplayableScore } from "./playerScore";
import { CrownIcon, TrophyIcon } from "./playFormIcons";
import styles from "./PlayForm.module.css";

// Avatar de una fila de jugador: fantasma para anónimos, miembro de TurnoCero
// (por @BGG) si está vinculado, si no iniciales.
function PlayerAvatar({ player, userMap }) {
  if (player.anonymous)
    return (
      <span className={styles.ghostAvatar} aria-hidden="true">
        👤
      </span>
    );
  const tc = player.username ? userMap[player.username.toLowerCase()] : null;
  return (
    <Avatar
      user={
        tc || {
          _id: player.username || player.name || "p",
          displayName: player.name || player.username,
          username: player.username,
        }
      }
      size="sm"
    />
  );
}

// Celda de puntaje (stepper − / input / +). Compartida por los modos versus y
// equipos para no duplicar el markup ni los aria-labels.
function ScoreCell({ value, onChange, onStep, label }) {
  return (
    <div className={styles.scoreCell}>
      <button
        type="button"
        className={styles.scoreStep}
        onClick={() => onStep(-1)}
        aria-label="Bajar puntaje"
        tabIndex={-1}
      >
        −
      </button>
      <input
        type="text"
        className={styles.scoreInput}
        placeholder="—"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={30}
        inputMode="numeric"
      />
      <button
        type="button"
        className={styles.scoreStep}
        onClick={() => onStep(1)}
        aria-label="Subir puntaje"
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}

/**
 * Una fila de jugador en la Sección 2 ("¿Quiénes jugaron?"). El padre
 * (PlayForm) mantiene el estado y pre-liga los handlers al índice del jugador,
 * así esta fila es presentacional: recibe el jugador + flags derivados + los
 * callbacks ya ligados.
 *
 * Props:
 *   player                    el jugador { name, username, score, win, new, anonymous, team }
 *   mode                      "versus" | "coop" | "equipos"
 *   position                  ranking 1-based (solo se muestra en versus con score)
 *   leader / isYou            flags de líder (corona) y de "vos"
 *   userMap                   mapa @BGG → usuario TC (para el avatar)
 *   activeTeams               equipos disponibles (modo equipos)
 *   canRemove                 si se muestra el botón de quitar (no para "vos")
 *   onScore(v) / onStep(d)    cambios de puntaje (ligados al índice)
 *   onTeam(t) / onToggleWin() / onRemove()
 */
export default function ScoreRow({
  player,
  mode,
  position,
  leader,
  isYou,
  userMap,
  activeTeams,
  canRemove,
  onScore,
  onStep,
  onTeam,
  onToggleWin,
  onRemove,
}) {
  const p = player;
  const scoreLabel = `Puntaje de ${p.name || p.username || "jugador"}`;
  return (
    <div
      className={`${styles.scoreRow} ${mode === "equipos" ? styles.scoreRowTeams : ""} ${leader ? styles.scoreRowLeader : ""} ${isYou ? styles.scoreRowYou : ""}`}
    >
      <span className={styles.scoreRank}>
        {mode === "versus"
          ? hasDisplayableScore(p.score)
            ? `#${position}`
            : "—"
          : "·"}
      </span>
      <span className={styles.scoreAvatar}>
        <PlayerAvatar player={p} userMap={userMap} />
      </span>
      <div className={styles.scorePlayer}>
        <span className={styles.scorePlayerName}>{p.name || p.username}</span>
        {!p.anonymous && p.username && (
          <span className={styles.scorePlayerHandle}>@{p.username}</span>
        )}
        {p.anonymous && <span className={styles.anonTag}>anónimo</span>}
        {isYou && <span className={styles.youPill}>vos</span>}
        {leader && (
          <span className={styles.scoreCrown}>
            <CrownIcon />
          </span>
        )}
        {p.new && (
          <span
            className={styles.newBadge}
            title="Primera vez que lo juega (autodetectado)"
          >
            ✨ Nuevo
          </span>
        )}
      </div>

      {mode === "versus" ? (
        <div className={styles.scoreControls}>
          <ScoreCell
            value={p.score}
            onChange={onScore}
            onStep={onStep}
            label={scoreLabel}
          />
          <button
            type="button"
            className={`${styles.winToggle} ${p.win ? styles.winToggleActive : ""}`}
            onClick={onToggleWin}
            aria-label="Ganó"
            aria-pressed={p.win}
            title="Ganó"
          >
            <TrophyIcon />
          </button>
        </div>
      ) : mode === "coop" ? (
        <span className={styles.teamTag}>Equipo</span>
      ) : (
        <div className={styles.scoreControls}>
          <ScoreCell
            value={p.score}
            onChange={onScore}
            onStep={onStep}
            label={scoreLabel}
          />
          <div className={styles.teamSelect}>
            <span className={styles.teamSelectLabel}>Elegí el equipo:</span>
            <div
              className={styles.teamPick}
              role="group"
              aria-label={`Equipo de ${p.name || p.username || "jugador"}`}
            >
              {activeTeams.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.teamBtn} ${styles[`teamBtn${t}`]} ${p.team === t ? styles.teamBtnActive : ""}`}
                  onClick={() => onTeam(t)}
                  aria-pressed={p.team === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No se puede quitar a "Vos" (el usuario): siempre juega. En su lugar va
          un espaciador del mismo ancho para alinear los controles con las
          demás filas. */}
      {canRemove &&
        (isYou ? (
          <span className={styles.scoreRemovePlaceholder} aria-hidden="true" />
        ) : (
          <button
            type="button"
            className={styles.scoreRemove}
            onClick={onRemove}
            aria-label="Quitar jugador"
          >
            ✕
          </button>
        ))}
    </div>
  );
}
