import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Meeple from "../../components/shared/Meeple";
import Avatar from "../../components/shared/Avatar";
import DateTimePicker from "../../components/shared/DateTimePicker";
import { API } from "../../api/endpoints";
import MyGamesPicker from "./MyGamesPicker";
import LocationPicker from "./LocationPicker";
import PlayerPicker from "./PlayerPicker";
import ExpansionsPicker from "./ExpansionsPicker";
import VariantPicker from "./VariantPicker";
import { composeComments, parseComments } from "./playComments";
import Scorecard, { gameInitials } from "./Scorecard";
import useBggUserMap from "./useBggUserMap";
import usePlayDraft, { isDraftMeaningful } from "./usePlayDraft";
import { hasDisplayableScore } from "./playerScore";
import {
  computePlayerPositions,
  sortPlayersByScoreDesc,
  assignWinsByScore,
} from "./playerPositions";
import { makeAnonName, isAnonName } from "./anonymousPlayer";
import styles from "./PlayForm.module.css";

// Trofeo inline (sin libs de iconos — convención del repo). Hereda currentColor.
function TrophyIcon() {
  return (
    <svg
      width="16"
      height="16"
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
function CrownIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

// Equipos (modo "Equipos"). En BGG el equipo se guarda en el campo Color/Team
// del jugador; lo serializamos como "Equipo A/B/C/D" y lo parseamos de vuelta.
const TEAM_IDS = ["A", "B", "C", "D"];
function teamFromColor(color) {
  const m = /^equipo\s+([A-D])$/i.exec(String(color || "").trim());
  return m ? m[1].toUpperCase() : "";
}

// Marca anonymous a partir del nombre reservado (al hidratar edición / carry) y
// recupera el equipo desde el color guardado.
function hydratePlayer(p) {
  return {
    name: p.name || "",
    username: p.username || "",
    score: hasDisplayableScore(p.score) ? String(p.score) : "",
    win: !!p.win,
    new: !!p.new,
    anonymous: !p.username && isAnonName(p.name),
    team: teamFromColor(p.color),
  };
}

const DURATION_PRESETS = [30, 60, 90, 120];

/**
 * Form de cargar / editar partida — estética "scoresheet" (handoff
 * design_handoff_bgwatch_create): 4 secciones numeradas + scorecard en vivo.
 * NO se acopla a la API — expone onSubmit(payload, { keepGoing }) / onCancel /
 * onDelete.
 *
 * Props:
 *   user, initialValues { game, details, players }, editMode, lockedGame,
 *   submitting, serverError, onSubmit, onCancel, onDelete (edición),
 *   allowMultiSave (muestra "Guardar y cargar otra"), lastJuntada.
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
  allowMultiSave = false,
  lastJuntada = null,
}) {
  const bggUsername = user?.bggUsername;

  const draftEnabled =
    !editMode && !initialValues.game && !initialValues.players?.length;
  const {
    load: loadDraft,
    save: saveDraft,
    clear: clearDraft,
  } = usePlayDraft(bggUsername);

  // ── Exit animation ──────────────────────────────────────────────────
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

  // ── State ───────────────────────────────────────────────────────────
  const [game, setGame] = useState(initialValues.game || null);
  // El `comments` que llega trae bloques (expansiones/variante) + firma; lo
  // separamos para mostrar SÓLO las notas del usuario y reconstruir los chips.
  const parsedComments = parseComments(initialValues.details?.comments || "");
  const [details, setDetails] = useState(() => ({
    playdate: initialValues.details?.playdate || todayIso(),
    length: initialValues.details?.length ?? "",
    location: initialValues.details?.location || "",
    quantity: initialValues.details?.quantity || 1,
    comments: parsedComments.notes,
    incomplete: !!initialValues.details?.incomplete,
    nowinstats: !!initialValues.details?.nowinstats,
  }));
  // Expansiones jugadas + variante/tablero (van dentro de `comments` a BGG).
  const [expansions, setExpansions] = useState(parsedComments.expansions);
  const [variant, setVariant] = useState(parsedComments.variant);
  // ¿El comentario original ya tenía la firma? Para preservarla al editar
  // (la firma se AGREGA sólo en partidas nuevas, pero no se borra si ya estaba).
  const hadSignature = parsedComments.signed;
  // Picker abierto en la sección del juego: null | "exp" | "variant".
  const [gamePicker, setGamePicker] = useState(null);
  const gameExtrasRef = useRef(null);
  const [players, setPlayers] = useState(() =>
    initialValues.players && initialValues.players.length > 0
      ? initialValues.players.map(hydratePlayer)
      : [
          {
            name: user?.displayName || user?.nombre || user?.username || "",
            username: user?.bggUsername || "",
            score: "",
            win: false,
            new: false,
            anonymous: false,
            team: "",
          },
        ],
  );

  // Al editar, inferir el modo: "equipos" si todos traen color "Equipo X";
  // "coop" en el caso "Ganamos" (≥2 jug, sin puntajes y todos ganadores); si
  // no, versus.
  const initPlayers = initialValues.players || [];
  const initTeams = initPlayers.map((p) => teamFromColor(p.color));
  const isTeamsPlay =
    editMode && initPlayers.length >= 2 && initTeams.every(Boolean);
  const [mode, setMode] = useState(() => {
    if (!editMode) return "versus";
    if (isTeamsPlay) return "equipos";
    if (
      initPlayers.length >= 2 &&
      initPlayers.every((p) => !hasDisplayableScore(p.score)) &&
      initPlayers.every((p) => p.win)
    )
      return "coop";
    return "versus";
  });
  const [coopWin, setCoopWin] = useState(true);
  // Modo equipos: cuántos equipos hay (2–4) y cuál ganó.
  const [numTeams, setNumTeams] = useState(() =>
    isTeamsPlay ? Math.min(4, Math.max(2, new Set(initTeams).size)) : 2,
  );
  const [winningTeam, setWinningTeam] = useState(() => {
    if (!isTeamsPlay) return null;
    const w = initPlayers.find((p) => p.win);
    return w ? teamFromColor(w.color) : null;
  });

  // "Jugué en solitario": el paso de jugadores NO se completa con sólo "vos" a
  // menos que se tilde esto. Default true si venimos con 1 solo jugador
  // (edición / carry de una partida en solitario ya cargada).
  const [soloPlay, setSoloPlay] = useState(() => {
    const meaningful = (initialValues.players || []).filter(
      (p) => (p.name || "").trim() || (p.username || "").trim(),
    );
    return meaningful.length === 1;
  });

  const [adding, setAdding] = useState(false);
  const [suggestedDuration, setSuggestedDuration] = useState(null);
  // Cierra el popover del picker al clickear fuera del área (trigger + popover).
  const addAreaRef = useRef(null);
  useEffect(() => {
    if (!adding) return undefined;
    const onDown = (e) => {
      if (addAreaRef.current && !addAreaRef.current.contains(e.target)) {
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [adding]);

  // Cierra el popover de expansiones/variante al clickear fuera de su área.
  useEffect(() => {
    if (!gamePicker) return undefined;
    const onDown = (e) => {
      if (gameExtrasRef.current && !gameExtrasRef.current.contains(e.target)) {
        setGamePicker(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [gamePicker]);

  const toggleExpansion = (exp) =>
    setExpansions((arr) =>
      arr.some((e) => e.id === exp.id)
        ? arr.filter((e) => e.id !== exp.id)
        : [...arr, { id: exp.id, name: exp.name }],
    );

  // ── @BGG del roster (para autodetección "Nuevo") ────────────────────
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

  // ── Autodetección "Nuevo" (solo al crear) ───────────────────────────
  const detectRef = useRef(0);
  useEffect(() => {
    if (editMode || !game?.id) return undefined;
    const usernames = usernamesKey ? usernamesKey.split(",") : [];
    if (!usernames.length) return undefined;
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
    });
    return () => ac.abort();
  }, [game?.id, editMode, usernamesKey, user]);

  // ── Duración sugerida = tiempo de caja de BGG (playingtime) ──────────
  useEffect(() => {
    if (editMode || !game?.id) {
      setSuggestedDuration(null);
      return undefined;
    }
    if (game.playingTime !== undefined) {
      setSuggestedDuration(game.playingTime || null);
      return undefined;
    }
    const ac = new AbortController();
    axios
      .get(API.bgg.GAME(game.id), { signal: ac.signal })
      .then(({ data }) =>
        setSuggestedDuration(
          data.playingTime || data.maxPlayTime || data.minPlayTime || null,
        ),
      )
      .catch(() => {});
    return () => ac.abort();
  }, [game?.id, game?.playingTime, editMode]);

  // ── Borrador local ──────────────────────────────────────────────────
  const [draftOffer, setDraftOffer] = useState(null);
  useEffect(() => {
    if (!draftEnabled) return;
    const d = loadDraft();
    if (isDraftMeaningful(d)) setDraftOffer(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (draftOffer.players?.length)
      setPlayers(draftOffer.players.map(hydratePlayer));
    setDraftOffer(null);
  };
  const discardDraft = () => {
    clearDraft();
    setDraftOffer(null);
  };

  // ── Players helpers ─────────────────────────────────────────────────
  // Renumera los asientos anónimos 1..k de forma contigua (los nombres llevan
  // la semántica que el server filtra de "mis compañeros").
  const renumberAnon = (arr) => {
    let n = 0;
    return arr.map((p) =>
      p.anonymous ? { ...p, name: makeAnonName(++n) } : p,
    );
  };
  const updatePlayer = (idx, key, val) =>
    setPlayers((arr) =>
      arr.map((p, i) => (i === idx ? { ...p, [key]: val } : p)),
    );
  const removePlayer = (idx) =>
    setPlayers((arr) => renumberAnon(arr.filter((_, i) => i !== idx)));
  const addPlayer = ({ name = "", username = "" } = {}) =>
    setPlayers((arr) => [
      ...arr,
      {
        name,
        username,
        score: "",
        win: false,
        new: false,
        anonymous: false,
        team: "",
      },
    ]);
  const addAnonymous = () =>
    setPlayers((arr) =>
      renumberAnon([
        ...arr,
        {
          name: "",
          username: "",
          score: "",
          win: false,
          new: false,
          anonymous: true,
          team: "",
        },
      ]),
    );
  const updateDetail = (key, val) => setDetails((d) => ({ ...d, [key]: val }));

  // ── Equipos ─────────────────────────────────────────────────────────
  const activeTeams = TEAM_IDS.slice(0, numTeams);
  // Cambiar a "equipos" auto-asigna A/B alternado a quienes no tengan equipo.
  const selectMode = (m) => {
    if (m === "equipos") {
      setPlayers((arr) => {
        let auto = 0;
        return arr.map((p) =>
          p.team ? p : { ...p, team: TEAM_IDS[auto++ % 2] },
        );
      });
    }
    setMode(m);
  };
  const setPlayerTeam = (idx, team) =>
    setPlayers((arr) => arr.map((p, i) => (i === idx ? { ...p, team } : p)));
  const addTeam = () => setNumTeams((n) => Math.min(TEAM_IDS.length, n + 1));
  // Quitar el último equipo: reasigna sus jugadores al equipo A y limpia el
  // ganador si era ese equipo.
  const removeTeam = () => {
    if (numTeams <= 2) return;
    const removed = TEAM_IDS[numTeams - 1];
    setPlayers((arr) =>
      arr.map((p) => (p.team === removed ? { ...p, team: "A" } : p)),
    );
    if (winningTeam === removed) setWinningTeam(null);
    setNumTeams((n) => Math.max(2, n - 1));
  };

  // En equipos el puntaje NO reasigna el ganador (gana el equipo, no el score).
  const applyWins = (arr) =>
    mode === "equipos" ? arr : assignWinsByScore(arr);
  const updateScore = (idx, val) =>
    setPlayers((arr) =>
      applyWins(arr.map((p, i) => (i === idx ? { ...p, score: val } : p))),
    );
  const stepScore = (idx, delta) =>
    setPlayers((arr) =>
      applyWins(
        arr.map((p, i) => {
          if (i !== idx) return p;
          const cur = Number(p.score);
          const base = p.score.trim() !== "" && Number.isFinite(cur) ? cur : 0;
          return { ...p, score: String(base + delta) };
        }),
      ),
    );
  const sortByScore = () => setPlayers((arr) => sortPlayersByScoreDesc(arr));

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
        anonymous: false,
        team: "",
      })),
    );
    if (lastJuntada.location) updateDetail("location", lastJuntada.location);
  };
  const showLastJuntada = !editMode && (lastJuntada?.players?.length || 0) > 0;

  // ── Derived ─────────────────────────────────────────────────────────
  const meaningfulCount = players.filter(
    (p) => p.name.trim() || p.username.trim(),
  ).length;
  // El paso de jugadores NO se da por completo con sólo "vos": pide un segundo
  // jugador, o que se tilde "Jugué en solitario".
  const jugadoresDone =
    meaningfulCount >= 2 || (meaningfulCount === 1 && soloPlay);
  const positions = computePlayerPositions(players);
  // Ordenar por puntaje aplica donde hay puntajes individuales (versus y
  // equipos); en cooperativo no hay scores.
  const canSortByScore =
    mode !== "coop" &&
    players.length > 1 &&
    players.some((p) => hasDisplayableScore(p.score));
  const dateInvalid = !!details.playdate && details.playdate > todayIso();

  // Identidad del dueño ("vos") por @BGG; -1 si no está en el roster.
  const youIndex = useMemo(() => {
    const lo = (bggUsername || "").toLowerCase();
    if (!lo) return -1;
    return players.findIndex(
      (p) => p.username && p.username.trim().toLowerCase() === lo,
    );
  }, [players, bggUsername]);

  // Líder único (corona): sólo en versus, con al menos un score numérico y una
  // sola posición 1.
  const anyNumeric = players.some(
    (p) =>
      hasDisplayableScore(p.score) &&
      Number.isFinite(Number(String(p.score).trim())),
  );
  const leaderIndex = useMemo(() => {
    if (mode !== "versus" || !anyNumeric) return -1;
    const firsts = positions
      .map((pos, i) => (pos === 1 ? i : -1))
      .filter((i) => i >= 0);
    return firsts.length === 1 ? firsts[0] : -1;
  }, [mode, anyNumeric, positions]);

  // ¿Ganó este jugador? coop = todos; equipos = los del equipo ganador; versus
  // = su flag (autoasignado por score).
  const playerWins = (p) => {
    if (mode === "coop") return coopWin;
    if (mode === "equipos") return !!winningTeam && p.team === winningTeam;
    return p.win;
  };

  const hasResult =
    mode === "coop"
      ? true
      : mode === "equipos"
        ? !!winningTeam
        : leaderIndex >= 0;
  const youWin =
    mode === "coop"
      ? coopWin
      : mode === "equipos"
        ? youIndex >= 0 && players[youIndex]?.team === winningTeam
        : leaderIndex >= 0 && leaderIndex === youIndex;

  const stepDone = {
    juego: !!game,
    cuando: !!details.playdate && !dateInvalid,
    jugadores: jugadoresDone,
  };
  const doneCount = Object.values(stepDone).filter(Boolean).length;
  const canSubmit =
    stepDone.juego && stepDone.jugadores && !!details.playdate && !dateInvalid;

  const buildPlayers = () => {
    const filtered = players.filter((p) => p.name.trim() || p.username.trim());
    const pos = computePlayerPositions(filtered);
    return filtered.map((p, i) => {
      if (mode === "equipos") {
        const win = !!winningTeam && p.team === winningTeam;
        return {
          name: p.name.trim(),
          username: p.username.trim(),
          position: pos[i],
          score: p.score.trim(),
          color: p.team ? `Equipo ${p.team}` : "",
          win,
          new: p.new,
        };
      }
      return {
        name: p.name.trim(),
        username: p.username.trim(),
        position: mode === "coop" ? i + 1 : pos[i],
        score: mode === "coop" ? "" : p.score.trim(),
        win: mode === "coop" ? coopWin : p.win,
        new: p.new,
      };
    });
  };

  const submit = (keepGoing) => {
    if (!canSubmit || submitting) return;
    if (draftEnabled) clearDraft();
    // Comentario final = notas del usuario + bloques (expansiones/variante) +
    // firma. La firma se agrega sólo al crear, o si la partida ya la tenía.
    const composedComments = composeComments({
      notes: details.comments,
      expansions,
      variant,
      sign: !editMode || hadSignature,
    });
    onSubmit?.(
      {
        objectid: game.id,
        playdate: details.playdate,
        length: details.length === "" ? null : Number(details.length),
        location: details.location,
        quantity: Number(details.quantity) || 1,
        comments: composedComments,
        // `variant` (texto libre) se persiste server-side para autocompletar
        // futuras partidas del juego; no se manda a BGG (ya va en comments).
        variant,
        incomplete: details.incomplete,
        nowinstats: details.nowinstats,
        players: buildPlayers(),
      },
      { keepGoing: !!keepGoing },
    );
  };
  const handleFormSubmit = (e) => {
    e.preventDefault();
    submit(false);
  };

  // ── Scorecard rows + member avatars ─────────────────────────────────
  const userMap = useBggUserMap([{ players }]);
  const scorecardRows = players.map((p, i) => {
    const win = playerWins(p);
    return {
      key: `${i}-${p.username || p.name || "anon"}`,
      name: p.name || p.username || "Jugador",
      username: p.username,
      anonymous: p.anonymous,
      score: p.score,
      win,
      new: p.new,
      team: p.team,
      position: positions[i],
      you: i === youIndex,
      leader: mode === "equipos" ? win : i === leaderIndex,
    };
  });

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
        ← Cancelar y volver
      </button>

      <header className={styles.head}>
        <div>
          <div className={styles.kicker}>
            <Meeple /> BG WATCH · {editMode ? "editar" : "nueva entrada"}
          </div>
          <h1 className={styles.title}>
            {editMode ? "Editá la " : "Anotá la "}
            <em>partida.</em>
          </h1>
        </div>
        <div className={styles.progress}>
          <span className={styles.progressVal}>{doneCount}/3</span>
          <span className={styles.progressLbl}>secciones listas</span>
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
          {/* 1 · Juego */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span
                className={`${styles.sectionNum} ${stepDone.juego ? styles.sectionNumDone : ""}`}
              >
                {stepDone.juego ? <CheckIcon /> : "1"}
              </span>
              <span className={styles.sectionTitle}>¿Qué jugaron?</span>
            </div>

            {game ? (
              <>
                <div className={styles.gameSelected}>
                  <div className={styles.gameThumb}>
                    {game.thumbnail ? (
                      <img src={game.thumbnail} alt={game.name} />
                    ) : (
                      gameInitials(game.name)
                    )}
                  </div>
                  <div className={styles.gameInfo}>
                    <div className={styles.gameName}>{game.name}</div>
                    {game.year && (
                      <div className={styles.gameMeta}>{game.year}</div>
                    )}
                  </div>
                  {!lockedGame && (
                    <button
                      type="button"
                      className={styles.gameChange}
                      onClick={() => {
                        setGame(null);
                        setExpansions([]);
                        setVariant("");
                        setGamePicker(null);
                      }}
                    >
                      Cambiar
                    </button>
                  )}
                </div>

                {/* Chips de expansiones + variante elegidas */}
                {(expansions.length > 0 || variant) && (
                  <div className={styles.gameExtrasChips}>
                    {expansions.map((e) => (
                      <span key={e.id} className={styles.extraChip}>
                        {e.name}
                        <button
                          type="button"
                          onClick={() => toggleExpansion(e)}
                          aria-label={`Quitar ${e.name}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {variant && (
                      <span
                        className={`${styles.extraChip} ${styles.extraChipVariant}`}
                      >
                        🎲 {variant}
                        <button
                          type="button"
                          onClick={() => setVariant("")}
                          aria-label="Quitar variante"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {/* Botones: expansiones (izq) + variante/tablero (der) */}
                <div className={styles.gameExtrasActions} ref={gameExtrasRef}>
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() =>
                      setGamePicker((p) => (p === "exp" ? null : "exp"))
                    }
                    aria-expanded={gamePicker === "exp"}
                  >
                    + Expansiones jugadas
                  </button>
                  <button
                    type="button"
                    className={`${styles.addBtn} ${styles.gameExtrasRight}`}
                    onClick={() =>
                      setGamePicker((p) => (p === "variant" ? null : "variant"))
                    }
                    aria-expanded={gamePicker === "variant"}
                  >
                    + Variante/tablero
                  </button>
                  {gamePicker === "exp" && (
                    <div className={styles.playerPickerPop}>
                      <ExpansionsPicker
                        gameId={game.id}
                        selected={expansions}
                        onToggle={toggleExpansion}
                        onClose={() => setGamePicker(null)}
                      />
                    </div>
                  )}
                  {gamePicker === "variant" && (
                    <div className={styles.playerPickerPop}>
                      <VariantPicker
                        bggUsername={bggUsername}
                        gameId={game.id}
                        value={variant}
                        onPick={(v) => setVariant(v)}
                        onClose={() => setGamePicker(null)}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              !lockedGame && (
                <MyGamesPicker
                  bggUsername={bggUsername}
                  onPick={(g) => {
                    setGame(g);
                    setExpansions([]);
                    setVariant("");
                  }}
                />
              )
            )}
          </section>

          {/* 2 · Quiénes jugaron */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span
                className={`${styles.sectionNum} ${stepDone.jugadores ? styles.sectionNumDone : ""}`}
              >
                {stepDone.jugadores ? <CheckIcon /> : "2"}
              </span>
              <span className={styles.sectionTitle}>¿Quiénes jugaron?</span>
              <span className={styles.sectionHint}>
                {players.length} jugador{players.length === 1 ? "" : "es"}
              </span>
            </div>

            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.mode} ${mode === "versus" ? styles.modeActive : ""}`}
                onClick={() => selectMode("versus")}
              >
                <span className={styles.modeT}>Competitiva</span>
                <span className={styles.modeD}>Cada uno con su puntaje</span>
              </button>
              <button
                type="button"
                className={`${styles.mode} ${mode === "coop" ? styles.modeActive : ""}`}
                onClick={() => selectMode("coop")}
              >
                <span className={styles.modeT}>Cooperativa</span>
                <span className={styles.modeD}>Ganan o pierden juntos</span>
              </button>
              <button
                type="button"
                className={`${styles.mode} ${mode === "equipos" ? styles.modeActive : ""}`}
                onClick={() => selectMode("equipos")}
              >
                <span className={styles.modeT}>Equipos</span>
                <span className={styles.modeD}>Gana un equipo</span>
              </button>
            </div>

            {mode === "coop" && (
              <div className={styles.coopOutcome}>
                <button
                  type="button"
                  className={`${styles.coopBtn} ${styles.coopWin} ${coopWin ? styles.coopBtnActive : ""}`}
                  onClick={() => setCoopWin(true)}
                >
                  <TrophyIcon />
                  <span>Ganamos</span>
                </button>
                <button
                  type="button"
                  className={`${styles.coopBtn} ${styles.coopLoss} ${!coopWin ? styles.coopBtnActive : ""}`}
                  onClick={() => setCoopWin(false)}
                >
                  <span className={styles.coopX}>✕</span>
                  <span>Perdimos</span>
                </button>
              </div>
            )}

            {mode === "equipos" && (
              <div className={styles.teamResult}>
                <span className={styles.teamResultLabel}>
                  ¿Qué equipo ganó?
                </span>
                <div className={styles.teamResultBtns}>
                  {numTeams > 2 && (
                    <button
                      type="button"
                      className={styles.addTeamBtn}
                      onClick={removeTeam}
                    >
                      − Equipo
                    </button>
                  )}
                  {activeTeams.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.teamWinBtn} ${winningTeam === t ? styles.teamWinBtnActive : ""}`}
                      onClick={() =>
                        setWinningTeam(winningTeam === t ? null : t)
                      }
                      aria-pressed={winningTeam === t}
                    >
                      Equipo {t}
                    </button>
                  ))}
                  {numTeams < TEAM_IDS.length && (
                    <button
                      type="button"
                      className={styles.addTeamBtn}
                      onClick={addTeam}
                    >
                      + Equipo
                    </button>
                  )}
                </div>
              </div>
            )}

            {(showLastJuntada || meaningfulCount === 1) && (
              <div className={styles.playersTopRow}>
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
                      {lastJuntada.players.length === 1
                        ? "jugador"
                        : "jugadores"}
                      {lastJuntada.location ? ` · ${lastJuntada.location}` : ""}
                    </span>
                  </button>
                )}
                {meaningfulCount === 1 && (
                  <label className={styles.soloPlay}>
                    <input
                      type="checkbox"
                      checked={soloPlay}
                      onChange={(e) => setSoloPlay(e.target.checked)}
                    />
                    Jugué en solitario
                  </label>
                )}
              </div>
            )}

            <div className={styles.scoreList}>
              {players.map((p, i) => {
                const win = playerWins(p);
                const isLeader =
                  i === leaderIndex || (mode === "equipos" && win);
                return (
                  <div
                    key={i}
                    className={`${styles.scoreRow} ${isLeader ? styles.scoreRowLeader : ""} ${i === youIndex ? styles.scoreRowYou : ""}`}
                  >
                    <span className={styles.scoreRank}>
                      {mode === "versus" ? `#${positions[i]}` : "·"}
                    </span>
                    <PlayerAvatar player={p} userMap={userMap} />
                    <div className={styles.scorePlayer}>
                      <span className={styles.scorePlayerName}>
                        {p.name || p.username}
                      </span>
                      {!p.anonymous && p.username && (
                        <span className={styles.scorePlayerHandle}>
                          @{p.username}
                        </span>
                      )}
                      {p.anonymous && (
                        <span className={styles.anonTag}>anónimo</span>
                      )}
                      {i === youIndex && (
                        <span className={styles.youPill}>vos</span>
                      )}
                      {isLeader && (
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
                            className={styles.scoreInput}
                            placeholder="—"
                            aria-label={`Puntaje de ${p.name || p.username || "jugador"}`}
                            value={p.score}
                            onChange={(e) => updateScore(i, e.target.value)}
                            maxLength={30}
                            inputMode="numeric"
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
                        <button
                          type="button"
                          className={`${styles.winToggle} ${p.win ? styles.winToggleActive : ""}`}
                          onClick={() => updatePlayer(i, "win", !p.win)}
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
                            className={styles.scoreInput}
                            placeholder="—"
                            aria-label={`Puntaje de ${p.name || p.username || "jugador"}`}
                            value={p.score}
                            onChange={(e) => updateScore(i, e.target.value)}
                            maxLength={30}
                            inputMode="numeric"
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
                        <div
                          className={styles.teamPick}
                          role="group"
                          aria-label={`Equipo de ${p.name || p.username || "jugador"}`}
                        >
                          {activeTeams.map((t) => (
                            <button
                              key={t}
                              type="button"
                              className={`${styles.teamBtn} ${p.team === t ? styles.teamBtnActive : ""}`}
                              onClick={() => setPlayerTeam(i, t)}
                              aria-pressed={p.team === t}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {players.length > 1 && (
                      <button
                        type="button"
                        className={styles.scoreRemove}
                        onClick={() => removePlayer(i)}
                        aria-label="Quitar jugador"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* El picker se DESPLIEGA como popover (no empuja el contenido),
                igual que el de ubicación. */}
            <div className={styles.addPlayerArea} ref={addAreaRef}>
              <div className={styles.playerActions}>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => setAdding((a) => !a)}
                  aria-expanded={adding}
                >
                  + Agregar jugador
                </button>
                <button
                  type="button"
                  className={styles.addGuestBtn}
                  onClick={addAnonymous}
                >
                  + Jugador anónimo
                </button>
                {canSortByScore && (
                  <button
                    type="button"
                    className={styles.sortBtn}
                    onClick={sortByScore}
                  >
                    ↓ Ordenar por puntaje
                  </button>
                )}
              </div>
              {adding && (
                <div className={styles.playerPickerPop}>
                  <PlayerPicker
                    bggUsername={bggUsername}
                    existing={players}
                    onPick={(pl) => addPlayer(pl)}
                    onCancel={() => setAdding(false)}
                  />
                </div>
              )}
            </div>
          </section>

          {/* 3 · Cuándo y dónde */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span
                className={`${styles.sectionNum} ${stepDone.cuando ? styles.sectionNumDone : ""}`}
              >
                {stepDone.cuando ? <CheckIcon /> : "3"}
              </span>
              <span className={styles.sectionTitle}>¿Cuándo y dónde?</span>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Fecha</label>
                <DateTimePicker
                  dateOnly
                  allowPast
                  maxDate={todayIso()}
                  value={details.playdate}
                  onChange={(v) => updateDetail("playdate", v)}
                />
                <div className={styles.quickRow}>
                  <button
                    type="button"
                    className={`${styles.quick} ${details.playdate === todayIso() ? styles.quickActive : ""}`}
                    onClick={() => updateDetail("playdate", todayIso())}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    className={`${styles.quick} ${details.playdate === yesterdayIso() ? styles.quickActive : ""}`}
                    onClick={() => updateDetail("playdate", yesterdayIso())}
                  >
                    Ayer
                  </button>
                </div>
                {dateInvalid && (
                  <span className={styles.fieldError}>
                    La fecha no puede ser futura.
                  </span>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Duración (min)</label>
                <input
                  type="number"
                  min={0}
                  className={styles.input}
                  value={details.length}
                  onChange={(e) => updateDetail("length", e.target.value)}
                  placeholder="60"
                />
                <div className={styles.quickRow}>
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.quick} ${Number(details.length) === m ? styles.quickActive : ""}`}
                      onClick={() => updateDetail("length", String(m))}
                    >
                      {m}min
                    </button>
                  ))}
                </div>
                {suggestedDuration && details.length === "" && (
                  <button
                    type="button"
                    className={styles.durationSuggest}
                    onClick={() =>
                      updateDetail("length", String(suggestedDuration))
                    }
                  >
                    Tiempo de caja: {suggestedDuration} min · usar
                  </button>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Dónde se jugó</label>
              <LocationPicker
                bggUsername={bggUsername}
                value={details.location}
                onPick={(loc) => updateDetail("location", loc)}
              />
            </div>

            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={details.incomplete}
                  onChange={(e) => updateDetail("incomplete", e.target.checked)}
                />
                Incompleta (no se terminó)
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={details.nowinstats}
                  onChange={(e) => updateDetail("nowinstats", e.target.checked)}
                />
                No contar para estadísticas
              </label>
            </div>
          </section>

          {/* 4 · Notas */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span
                className={`${styles.sectionNum} ${styles.sectionNumOptional}`}
              >
                4
              </span>
              <span className={styles.sectionTitle}>Notas</span>
              <span className={styles.sectionHint}>opcional</span>
            </div>
            <textarea
              className={styles.notes}
              value={details.comments}
              onChange={(e) => updateDetail("comments", e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Ese combo de la ronda 4, la jugada que definió todo, la revancha pendiente…"
            />
          </section>

          {serverError && <div className={styles.errorBox}>{serverError}</div>}

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={handleCancelClick}
              disabled={submitting}
            >
              Cancelar
            </button>
            <div className={styles.footerRight}>
              {allowMultiSave && !editMode && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => submit(true)}
                  disabled={!canSubmit || submitting}
                >
                  Guardar y cargar otra
                </button>
              )}
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={!canSubmit || submitting}
              >
                {submitting
                  ? "Guardando…"
                  : editMode
                    ? "Guardar cambios"
                    : "Guardar partida"}
              </button>
            </div>
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
          <div className={styles.previewLabel}>◆ Tu entrada · en vivo</div>
          <Scorecard
            game={game}
            date={details.playdate}
            location={details.location}
            duration={details.length === "" ? null : Number(details.length)}
            mode={mode}
            hasResult={hasResult}
            youWin={youWin}
            rows={scorecardRows}
            notes={details.comments}
            userMap={userMap}
          />
          <p className={styles.previewNote}>
            Se guarda en tu almanaque al confirmar.
          </p>
        </aside>
      </div>
    </div>
  );
}
