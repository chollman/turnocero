import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("bgwatch");
  return (
    <div className={styles.scoreCell}>
      <button
        type="button"
        className={styles.scoreStep}
        onClick={() => onStep(-1)}
        aria-label={t("scoreRow.lowerScore")}
        tabIndex={-1}
      >
        −
      </button>
      <input
        type="text"
        className={styles.scoreInput}
        placeholder={t("scoreRow.scorePlaceholder")}
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
        aria-label={t("scoreRow.raiseScore")}
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
 *   rankByWin                 versus sin puntajes: mostrar el ranking derivado del "Ganó"
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
  rankByWin = false,
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
  const { t } = useTranslation("bgwatch");
  const p = player;
  const scoreLabel = t("scoreRow.scoreOf", {
    name: p.name || p.username || t("scoreRow.playerFallback"),
  });
  return (
    <div
      className={`${styles.scoreRow} ${mode === "equipos" ? styles.scoreRowTeams : ""} ${leader ? styles.scoreRowLeader : ""} ${isYou ? styles.scoreRowYou : ""}`}
    >
      <span className={styles.scoreRank}>
        {mode === "versus"
          ? hasDisplayableScore(p.score) || rankByWin
            ? `#${position}`
            : t("scoreRow.rankDash")
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
        {p.anonymous && (
          <span className={styles.anonTag}>{t("scoreRow.anonTag")}</span>
        )}
        {isYou && <span className={styles.youPill}>{t("scoreRow.youPill")}</span>}
        {leader && (
          <span className={styles.scoreCrown}>
            <CrownIcon />
          </span>
        )}
        {p.new && (
          <span className={styles.newBadge} title={t("scoreRow.newTitle")}>
            {t("scoreRow.new")}
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
            aria-label={t("scoreRow.wonAria")}
            aria-pressed={p.win}
            title={t("scoreRow.wonTitle")}
          >
            <TrophyIcon />
          </button>
        </div>
      ) : mode === "coop" ? (
        <span className={styles.teamTag}>{t("scoreRow.team")}</span>
      ) : (
        <div className={styles.scoreControls}>
          <ScoreCell
            value={p.score}
            onChange={onScore}
            onStep={onStep}
            label={scoreLabel}
          />
          <div className={styles.teamSelect}>
            <span className={styles.teamSelectLabel}>
              {t("scoreRow.pickTeam")}
            </span>
            <div
              className={styles.teamPick}
              role="group"
              aria-label={t("scoreRow.teamOf", {
                name: p.name || p.username || t("scoreRow.playerFallback"),
              })}
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
            aria-label={t("scoreRow.removePlayer")}
          >
            ✕
          </button>
        ))}
    </div>
  );
}
