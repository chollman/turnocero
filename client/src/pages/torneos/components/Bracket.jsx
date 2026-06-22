import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import UserRef, { GhostIcon } from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import i18n from "../../../i18n";
import styles from "../Bracket.module.css";

const DESKTOP = 960;

/**
 * Renders a single-elimination bracket grouped by round.
 * On desktop: horizontal columns. On mobile: one round at a time with a selector.
 */
export default function Bracket({ matches, isAdmin, onRecord, onUndo }) {
  const { t } = useTranslation("torneos");
  const rounds = groupByRound(matches);
  const totalRounds = rounds.length;

  const [activeRound, setActiveRound] = useState(0);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < DESKTOP,
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < DESKTOP);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // On mobile, jump to the first round with unresolved matches.
  useEffect(() => {
    if (!isMobile) return;
    const firstPending = rounds.findIndex((round) =>
      round.some((m) => m.status === "pending" && m.playerA && m.playerB),
    );
    if (firstPending >= 0) setActiveRound(firstPending);
  }, [isMobile, matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (rounds.length === 0) {
    return <p className={styles.empty}>{t("bracket.empty")}</p>;
  }

  // Round 1 is a play-in round when it has fewer matches than round 2.
  const hasPlayIn = rounds.length > 1 && rounds[0].length < rounds[1].length;
  const roundLabels = rounds.map((_, i) =>
    roundLabel(i + 1, totalRounds, hasPlayIn),
  );

  return (
    <div className={styles.bracketWrap}>
      {isMobile && (
        <div className={styles.roundSelector}>
          {roundLabels.map((label, i) => (
            <button
              key={i}
              className={`${styles.roundTab} ${activeRound === i ? styles.roundTabActive : ""}`}
              onClick={() => setActiveRound(i)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.bracket}>
        {rounds.map((round, rIdx) => {
          if (isMobile && rIdx !== activeRound) return null;
          return (
            <div key={rIdx} className={styles.round}>
              {!isMobile && (
                <h4 className={styles.roundTitle}>{roundLabels[rIdx]}</h4>
              )}
              <div className={styles.roundMatches} data-round={rIdx + 1}>
                {round.map((match) => (
                  <BracketMatch
                    key={match._id}
                    match={match}
                    isAdmin={isAdmin}
                    onRecord={onRecord}
                    onUndo={onUndo}
                    isFinal={rIdx === totalRounds - 1}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({ match, isAdmin, onRecord, onUndo, isFinal }) {
  const { t } = useTranslation("torneos");
  const aWinner =
    match.winner &&
    String(match.winner._id || match.winner) === String(match.playerA?._id);
  const bWinner =
    match.winner &&
    String(match.winner._id || match.winner) === String(match.playerB?._id);
  const isBye = match.status === "bye";
  const isCompleted = match.status === "completed";
  const canRecord =
    isAdmin && match.status === "pending" && match.playerA && match.playerB;

  return (
    <div
      className={`${styles.match} ${isBye ? styles.matchBye : ""} ${isFinal ? styles.matchFinal : ""}`}
    >
      <Slot
        user={match.playerA}
        isWinner={aWinner}
        isBye={isBye && !match.playerB}
      />
      <div className={styles.matchDivider} />
      <Slot
        user={match.playerB}
        isWinner={bWinner}
        isBye={isBye && !match.playerA}
      />

      {isBye && <span className={styles.byeBadge}>{t("bracket.bye")}</span>}

      {canRecord && (
        <button className={styles.recordBtn} onClick={() => onRecord(match)}>
          {t("bracket.record")}
        </button>
      )}
      {isCompleted && isAdmin && (
        <button className={styles.undoBtn} onClick={() => onUndo(match)}>
          {t("bracket.undo")}
        </button>
      )}
    </div>
  );
}

function Slot({ user, isWinner, isBye }) {
  const { t } = useTranslation("torneos");
  if (!user) {
    return (
      <div className={`${styles.slot} ${styles.slotEmpty}`}>
        <span className={styles.slotPlaceholder}>
          {isBye ? "—" : t("bracket.tbd")}
        </span>
      </div>
    );
  }
  const info = getUserDisplay(user);
  if (info.isDeleted) {
    return (
      <div className={`${styles.slot} ${styles.slotDeleted}`}>
        <GhostIcon size={12} /> <span>{t("bracket.deletedUser")}</span>
      </div>
    );
  }
  return (
    <div className={`${styles.slot} ${isWinner ? styles.slotWinner : ""}`}>
      <span className={styles.slotName}>
        <UserRef user={user} noLink />
      </span>
      {isWinner && <span className={styles.slotCheck}>✓</span>}
    </div>
  );
}

function groupByRound(matches) {
  const map = new Map();
  for (const m of matches) {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round).push(m);
  }
  return [...map.keys()]
    .sort((a, b) => a - b)
    .map((r) => map.get(r).sort((x, y) => x.matchIndex - y.matchIndex));
}

function roundLabel(round, total, hasPlayIn) {
  if (hasPlayIn && round === 1) return i18n.t("torneos:bracket.preliminary");
  // For main-bracket labels, ignore the play-in round when counting backwards from the final.
  const mainTotal = total - (hasPlayIn ? 1 : 0);
  const mainRound = round - (hasPlayIn ? 1 : 0);
  if (mainRound === mainTotal) return i18n.t("torneos:bracket.final");
  if (mainRound === mainTotal - 1) return i18n.t("torneos:bracket.semifinal");
  if (mainRound === mainTotal - 2)
    return i18n.t("torneos:bracket.quarterfinals");
  if (mainRound === mainTotal - 3) return i18n.t("torneos:bracket.roundOf16");
  return i18n.t("torneos:bracket.round", { number: mainRound });
}
