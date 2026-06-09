import { useMemo } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import { hasDisplayableScore } from "./playerScore";
import styles from "./PlayForm.module.css";

// 2 letras para el thumbnail del juego (espeja el estilo de la partida ya
// registrada): iniciales de las 2 primeras palabras, o las 2 primeras letras.
export function gameInitials(name) {
  if (!name) return "?";
  const clean = String(name)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return "sin fecha";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "sin fecha";
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Iconos inline (convención del repo: SVG inline, hereda currentColor) ──
const ico = {
  cal: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  pin: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  clock: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  users: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 19v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  ),
  trophy: (
    <svg
      width="14"
      height="14"
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
  ),
  crown: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />
    </svg>
  ),
  // Dado/grilla — mismo glifo que el link de BG Watch del autor en CompartidaCard.
  bgwatch: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
};

// Banner neutral para el modo público (juntada compartida): muestra al/los
// ganador/es en vez de "¡Ganaste!/Perdiste" (que es relativo al que mira).
// Devuelve { label, state } con state ∈ "win" | "loss" | "empty".
export function deriveWinnerLabel(rows, mode) {
  const winners = rows.filter((r) => r.win);
  if (mode === "coop") {
    return winners.length
      ? { label: "¡Ganaron!", state: "win" }
      : { label: "Perdieron", state: "loss" };
  }
  if (mode === "equipos") {
    const team = winners[0]?.team;
    return team
      ? { label: `Ganó el Equipo ${team}`, state: "win" }
      : { label: "Sin resultado", state: "empty" };
  }
  // versus
  if (winners.length === 1) {
    return { label: `Ganó ${winners[0].name}`, state: "win" };
  }
  if (winners.length > 1) return { label: "Empate", state: "win" };
  return { label: "Sin resultado", state: "empty" };
}

/**
 * Scorecard en vivo del form de cargar partida — estilo ticket/scoresheet del
 * handoff. Presentacional: recibe filas ya construidas (con `position`, `you`,
 * `leader`) y los flags de resultado; no calcula ranking. Reusa <Avatar> +
 * `userMap` para mostrar el avatar de los co-jugadores que son miembros.
 *
 * `publicView` (juntada compartida): banner por ganador, sin "(vos)" ni el
 * highlight del jugador propio — el post lo ve cualquiera, no hay "vos". En ese
 * modo las filas pueden traer `profileHref` (perfil público de TurnoCero) y
 * `bgwatchHref` (BG Watch); el nombre se vuelve link y aparece un ícono de BG
 * Watch (este último solo si `bgwatchEnabled`, que lo gatea el caller).
 */
export default function Scorecard({
  game,
  date,
  location,
  duration,
  mode = "versus",
  hasResult = false,
  youWin = false,
  rows = [],
  notes = "",
  userMap = {},
  publicView = false,
  bgwatchEnabled = false,
}) {
  const initials = game ? gameInitials(game.name) : null;
  const stopProp = (e) => e.stopPropagation();

  const displayRows = useMemo(() => {
    if (mode === "coop") return rows;
    return [...rows].sort((a, b) => {
      const pa = a.position || 99;
      const pb = b.position || 99;
      return pa - pb;
    });
  }, [rows, mode]);

  const winner = publicView ? deriveWinnerLabel(displayRows, mode) : null;
  const bannerLabel = publicView
    ? winner.label
    : hasResult
      ? mode === "coop"
        ? youWin
          ? "¡Ganaron!"
          : "Perdieron"
        : youWin
          ? "¡Ganaste!"
          : "Perdiste"
      : "Cargá los puntajes para ver el resultado";
  const bannerState = publicView
    ? winner.state
    : !hasResult
      ? "empty"
      : youWin
        ? "win"
        : "loss";

  return (
    <div className={styles.scorecard}>
      <div className={styles.scorecardTop}>
        <div className={styles.scorecardKicker}>
          <Meeple /> BG Watch · partida
        </div>
        <div className={styles.scorecardGameRow}>
          <div
            className={`${styles.scorecardThumb} ${!game ? styles.scorecardThumbEmpty : ""}`}
          >
            {game?.thumbnail ? (
              <img src={game.thumbnail} alt={game.name} />
            ) : (
              initials || "🎲"
            )}
          </div>
          <div
            className={`${styles.scorecardGameName} ${!game ? styles.scorecardGameNameEmpty : ""}`}
          >
            {game ? game.name : "Elegí un juego"}
          </div>
        </div>
        <div className={styles.scorecardMeta}>
          <span>
            {ico.cal} {fmtDate(date)}
          </span>
          {location?.trim() && (
            <span>
              {ico.pin} {location}
            </span>
          )}
          {duration > 0 && (
            <span>
              {ico.clock} {duration} min
            </span>
          )}
          <span>
            {ico.users} {rows.length} jug.
          </span>
        </div>
      </div>

      <div className={styles.scorecardBody}>
        <div
          className={`${styles.scorecardBanner} ${styles[`scorecardBanner_${bannerState}`]}`}
          aria-live="polite"
        >
          {bannerState === "win" && ico.trophy} {bannerLabel}
        </div>

        {displayRows.length > 0 ? (
          <div className={styles.scorecardPlayers}>
            {displayRows.map((p) => {
              const tcUser =
                p.username && !p.anonymous
                  ? userMap[p.username.toLowerCase()]
                  : null;
              return (
                <div
                  key={p.key}
                  className={`${styles.scorecardPlayer} ${p.leader ? styles.scorecardPlayerLead : ""} ${!publicView && p.you ? styles.scorecardPlayerYou : ""}`}
                >
                  <span className={styles.scorecardPr}>
                    {mode === "coop"
                      ? ico.users
                      : mode === "equipos"
                        ? p.team || "·"
                        : p.position
                          ? `#${p.position}`
                          : "—"}
                  </span>
                  {p.anonymous ? (
                    <span className={styles.ghostAvatar} aria-hidden="true">
                      👤
                    </span>
                  ) : tcUser ? (
                    <Avatar user={tcUser} size="xs" />
                  ) : (
                    <Avatar
                      user={{
                        _id: p.key,
                        displayName: p.name,
                        username: p.username,
                      }}
                      size="xs"
                    />
                  )}
                  <span className={styles.scorecardNm}>
                    {p.profileHref ? (
                      <Link
                        to={p.profileHref}
                        className={styles.scorecardNmLink}
                        onClick={stopProp}
                      >
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                    {!publicView && p.you ? " (vos)" : ""}
                    {p.leader && (
                      <span className={styles.scorecardCrown}>{ico.crown}</span>
                    )}
                    {bgwatchEnabled && p.bgwatchHref && (
                      <Link
                        to={p.bgwatchHref}
                        className={styles.scorecardBgw}
                        onClick={stopProp}
                        title={`Ver BG Watch de @${p.username}`}
                        aria-label={`Ver BG Watch de ${p.name}`}
                      >
                        {ico.bgwatch}
                      </Link>
                    )}
                  </span>
                  <span className={styles.scorecardSc}>
                    {mode === "coop"
                      ? p.win
                        ? "✦"
                        : "○"
                      : mode === "equipos"
                        ? hasDisplayableScore(p.score)
                          ? p.score
                          : p.win
                            ? "✦"
                            : "○"
                        : hasDisplayableScore(p.score)
                          ? p.score
                          : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.scorecardEmpty}>Sin jugadores todavía</div>
        )}

        {notes.trim() && <div className={styles.scorecardNotes}>“{notes}”</div>}
      </div>
    </div>
  );
}
