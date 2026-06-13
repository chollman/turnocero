import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Meeple from "../../components/shared/Meeple";
import DateTimePicker from "../../components/shared/DateTimePicker";
import InfoTooltip from "../../components/shared/InfoTooltip";
import BackButton from "../../components/shared/BackButton";
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
import useClickOutside from "../../hooks/useClickOutside";
import CommunitySelect from "../../components/shared/CommunitySelect";
import JuntadaFields from "../compartidas/JuntadaFields";
import { buildPlayResult } from "./buildPlayResult";
import ScoreRow from "./ScoreRow";
import {
  TrophyIcon,
  CheckIcon,
  TrashIcon,
  UserPlusIcon,
  SaveAnotherIcon,
  SortDescIcon,
  BoxTimeIcon,
  PlusIcon,
} from "./playFormIcons";
import styles from "./PlayForm.module.css";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// Identidad de una fila del roster para la autodetección "Nuevo": @BGG
// (lowercase) si existe, si no el nombre (lowercase). DEBE coincidir con
// `rosterPlayerKey` del server (bggAggregations) — es la clave del mapa `flags`.
function rosterPlayerKey(p) {
  const u = (p?.username || "").trim().toLowerCase();
  if (u) return `u:${u}`;
  const n = (p?.name || "").trim().toLowerCase();
  return n ? `n:${n}` : null;
}

const DURATION_PRESETS = [30, 90, 120];

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

  // ── Sección 5: "Compartí esta partida" (opcional, solo al crear) ──────
  // Crea, además de la partida, una juntada en Compartidas (mismo form que una
  // juntada normal) y copia el deeplink. `community` la maneja CommunitySelect
  // pero vive en el mismo objeto; JuntadaFields la deja intacta al hacer onChange.
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareValue, setShareValue] = useState({
    privacy: "public",
    community: "",
    games: [],
    title: "",
    body: "",
    images: [],
  });
  // Pre-cargar el juego recién registrado en la juntada, una sola vez al activar
  // la sección (quitable). Si el juego se elige después, el efecto re-corre.
  const shareSeededRef = useRef(false);

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
  // ¿El usuario tomó control manual de quién ganó? Mientras sea false (default
  // al crear), cargar un puntaje autoasigna el ganador al score más alto. En
  // cuanto toca el toggle de "Ganó" (o al editar una partida ya cargada) pasa a
  // true y los cambios de puntaje dejan de pisar la elección — clave para juegos
  // donde NO gana el mayor puntaje.
  const [winsManual, setWinsManual] = useState(editMode);
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
  // Cierra el popover del picker de jugador / el de expansiones-variante al
  // clickear fuera de su área (trigger + popover).
  const addAreaRef = useRef(null);
  useClickOutside(addAreaRef, () => setAdding(false), adding);
  useClickOutside(gameExtrasRef, () => setGamePicker(null), !!gamePicker);

  const toggleExpansion = (exp) =>
    setExpansions((arr) =>
      arr.some((e) => e.id === exp.id)
        ? arr.filter((e) => e.id !== exp.id)
        : [...arr, { id: exp.id, name: exp.name }],
    );

  // ── Identidad del roster (para autodetección "Nuevo") ───────────────
  // Cambia al agregar/quitar/elegir jugadores (no al editar puntajes/ganador),
  // así el efecto re-corre sólo cuando hace falta. Excluye anónimos (no son una
  // identidad trackeable y nunca se marcan "Nuevo").
  const rosterKey = useMemo(
    () =>
      [
        ...new Set(
          players
            .filter((p) => !p.anonymous)
            .map(rosterPlayerKey)
            .filter(Boolean),
        ),
      ]
        .sort()
        .join(","),
    [players],
  );
  // Roster (nombre+@BGG, sin anónimos) que se manda a la autodetección. Se
  // recomputa sólo cuando cambia `rosterKey` (alta/baja/elección de jugador),
  // no al editar puntajes/ganador — `rosterKey` ya captura ese subconjunto.
  const detectRoster = useMemo(
    () =>
      players
        .filter((p) => !p.anonymous && (p.name.trim() || p.username.trim()))
        .map((p) => ({ name: p.name.trim(), username: p.username.trim() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rosterKey],
  );

  // ── Autodetección "Nuevo" (solo al crear) ───────────────────────────
  // Manda TODO el roster al server, que decide por jugador: los sincronizados
  // en TurnoCero (incluido el dueño) por su propio historial; los invitados NO
  // sincronizados se marcan nuevos la primera vez que el dueño los anota jugando
  // ese juego. Ver server `computeNewFlags`.
  const detectRef = useRef(0);
  useEffect(() => {
    if (editMode || !game?.id || !bggUsername || !detectRoster.length)
      return undefined;
    const myId = ++detectRef.current;
    const ac = new AbortController();
    axios
      .post(
        API.bgg.NUEVOS(bggUsername, game.id),
        { players: detectRoster },
        { signal: ac.signal },
      )
      .then(({ data }) => {
        if (myId !== detectRef.current) return;
        const flags = data?.flags || {};
        setPlayers((arr) =>
          arr.map((p) => {
            if (p.anonymous) return p;
            const key = rosterPlayerKey(p);
            return key && key in flags ? { ...p, new: flags[key] } : p;
          }),
        );
      })
      .catch(() => {});
    return () => ac.abort();
  }, [game?.id, editMode, bggUsername, detectRoster]);

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
  // Tampoco si el usuario ya eligió ganador a mano (winsManual).
  const applyWins = (arr) =>
    mode === "equipos" || winsManual ? arr : assignWinsByScore(arr);
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

  // Filas del scorecard — alimentan tanto el preview en vivo como el snapshot
  // de resultados (`playResult`) que se embebe en la juntada compartida. Se
  // derivan acá arriba para que `submit` pueda armar el playResult.
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

  // Al abrir la sección 5 (una sola vez), pre-cargar el juego de la partida en
  // la juntada — solo si el usuario no agregó juegos. No persiste en el borrador.
  useEffect(() => {
    if (editMode || !shareEnabled || shareSeededRef.current || !game) return;
    shareSeededRef.current = true;
    const seededGame = {
      id: game.id,
      name: game.name,
      thumbnail: game.thumbnail,
      image: game.image,
      year: game.year,
    };
    setShareValue((v) => (v.games.length ? v : { ...v, games: [seededGame] }));
  }, [editMode, shareEnabled, game]);

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
    // Sección 5 (solo al crear): snapshot de resultados para el widget de la
    // juntada (mismo dato que el preview en vivo). Cuenta como "contenido": abrir
    // la sección con un juego ya alcanza para compartir, aunque no haya texto/foto.
    const playResult = buildPlayResult({ scorecardRows, mode, game, details });
    const hasShareContent =
      shareValue.title.trim() ||
      shareValue.body.trim() ||
      shareValue.images.length > 0 ||
      !!playResult;
    const share =
      !editMode && shareEnabled && hasShareContent
        ? {
            privacy: shareValue.privacy,
            community: shareValue.community,
            title: shareValue.title,
            body: shareValue.body,
            games: shareValue.games,
            images: shareValue.images,
            playResult,
          }
        : null;

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
      { keepGoing: !!keepGoing, share },
    );
  };
  const handleFormSubmit = (e) => {
    e.preventDefault();
    submit(false);
  };

  // Avatares de co-jugadores que son miembros de TurnoCero (para el preview).
  const userMap = useBggUserMap([{ players }]);

  return (
    <div
      className={`${styles.page} ${exiting ? styles.pageExit : ""}`}
      onAnimationEnd={handlePageAnimationEnd}
    >
      <BackButton onClick={handleCancelClick} disabled={submitting}>
        Cancelar y volver
      </BackButton>

      <header className={styles.head}>
        <div>
          <div className={styles.kicker}>
            <Meeple /> BG WATCH · {editMode ? "editar" : "nueva entrada"}
          </div>
          <h1 className={styles.title}>
            {editMode ? "Editá la " : "Anotá la "}
            <em>partida</em>.
          </h1>
          <p className={styles.sub}>
            {editMode
              ? "Cambiá lo que haga falta. Se actualiza también en BoardGameGeek."
              : "Cargá quién jugó, los puntajes y dónde. Queda en tu almanaque de BG Watch y en BoardGameGeek."}
          </p>
        </div>
        <div className={styles.progress}>
          <span className={styles.progressVal}>{doneCount}/3</span>
          <span className={styles.progressLbl}>secciones listas</span>
        </div>
      </header>

      {/* Stepper de 3 puntos (mobile) — espeja el progreso N/3 del header,
          que en pantallas chicas se oculta (handoff phone 4). */}
      <div
        className={styles.stepsDots}
        role="img"
        aria-label={`${doneCount} de 3 secciones listas`}
      >
        {[stepDone.juego, stepDone.jugadores, stepDone.cuando].map(
          (done, i, arr) => {
            const activeIdx = arr.findIndex((d) => !d);
            return (
              <span
                key={i}
                className={`${styles.stepDot} ${
                  done
                    ? styles.stepDotDone
                    : i === activeIdx
                      ? styles.stepDotActive
                      : ""
                }`}
              />
            );
          },
        )}
      </div>

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
              <span className={styles.sectionTitle}>
                ¿Qué jugaron?
                <InfoTooltip placement="bottom" label="Ayuda: ¿Qué jugaron?">
                  Elegí el juego de la partida — buscalo en tu lista o en BGG.
                  Después podés sumar las <strong>expansiones</strong> jugadas o
                  una <strong>variante/tablero</strong>.
                </InfoTooltip>
              </span>
              {game && game.numPlays != null && (
                <span className={styles.sectionHint}>de tu colección</span>
              )}
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
                    {(game.year || game.numPlays > 0) && (
                      <div className={styles.gameMeta}>
                        {[
                          game.year,
                          game.numPlays > 0 ? `${game.numPlays}× jugado` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                  {!lockedGame && (
                    <button
                      type="button"
                      className={styles.btnGhost}
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
                    className={styles.btnGhost}
                    onClick={() =>
                      setGamePicker((p) => (p === "exp" ? null : "exp"))
                    }
                    aria-expanded={gamePicker === "exp"}
                  >
                    + Expansión jugada
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnGhost} ${styles.pushRight}`}
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
              <span className={styles.sectionTitle}>
                ¿Quiénes jugaron?
                <InfoTooltip
                  placement="bottom"
                  label="Ayuda: ¿Quiénes jugaron?"
                >
                  Sumá a los jugadores (compañeros, usuarios de TurnoCero o
                  anónimos) y cargá sus <strong>puntajes</strong>. Arriba elegís
                  el modo: <strong>competitiva</strong>,{" "}
                  <strong>cooperativa</strong> o <strong>equipos</strong>. Si
                  jugaste solo/a, marcá la opción de partida en solitario.
                </InfoTooltip>
              </span>
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
                <span className={styles.modeD}>
                  <span className={styles.modeDLong}>
                    Cada uno con su puntaje
                  </span>
                  <span className={styles.modeDShort}>Con puntaje</span>
                </span>
              </button>
              <button
                type="button"
                className={`${styles.mode} ${mode === "coop" ? styles.modeActive : ""}`}
                onClick={() => selectMode("coop")}
              >
                <span className={styles.modeT}>Cooperativa</span>
                <span className={styles.modeD}>
                  <span className={styles.modeDLong}>
                    Ganan o pierden juntos
                  </span>
                  <span className={styles.modeDShort}>Juntos</span>
                </span>
              </button>
              <button
                type="button"
                className={`${styles.mode} ${mode === "equipos" ? styles.modeActive : ""}`}
                onClick={() => selectMode("equipos")}
              >
                <span className={styles.modeT}>Equipos</span>
                <span className={styles.modeD}>
                  <span className={styles.modeDLong}>Gana un equipo</span>
                  <span className={styles.modeDShort}>Bandos</span>
                </span>
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
                      className={`${styles.btnGhost} ${styles.btnSmall}`}
                      onClick={removeTeam}
                    >
                      − Equipo
                    </button>
                  )}
                  {activeTeams.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.teamWinBtn} ${styles[`teamWin${t}`]} ${winningTeam === t ? styles.teamWinBtnActive : ""}`}
                      onClick={() =>
                        setWinningTeam(winningTeam === t ? null : t)
                      }
                      aria-pressed={winningTeam === t}
                    >
                      <span className={styles.teamDot} aria-hidden="true" />
                      Equipo {t}
                    </button>
                  ))}
                  {numTeams < TEAM_IDS.length && (
                    <button
                      type="button"
                      className={`${styles.btnGhost} ${styles.btnSmall}`}
                      onClick={addTeam}
                    >
                      + Equipo
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Helper-pills (handoff v2): con UN solo jugador, "Jugué en
                solitario" y "Usar última juntada" comparten estilo, lado a
                lado. Ambas desaparecen al sumar un segundo jugador. */}
            {meaningfulCount === 1 && (
              <div className={styles.helperRow}>
                <label
                  className={`${styles.helperPill} ${soloPlay ? styles.helperPillOn : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={soloPlay}
                    onChange={(e) => setSoloPlay(e.target.checked)}
                  />
                  <span className={styles.hpCheck} aria-hidden="true">
                    {soloPlay && <CheckIcon />}
                  </span>
                  <span className={styles.hpText}>
                    <span className={styles.hpTextFull}>Jugué en solitario</span>
                    <span className={styles.hpTextShort}>Solitario</span>
                  </span>
                </label>
                {showLastJuntada && (
                  <button
                    type="button"
                    className={`${styles.helperPill} ${styles.helperPillRight}`}
                    onClick={applyLastJuntada}
                    title={
                      lastJuntada.location
                        ? `Jugadores y ubicación (${lastJuntada.location}) de tu última partida`
                        : "Jugadores de tu última partida"
                    }
                  >
                    <span className={styles.hpIcon} aria-hidden="true">
                      ↺
                    </span>
                    <span className={styles.hpText}>
                      <span className={styles.hpTextFull}>Usar última juntada</span>
                      <span className={styles.hpTextShort}>Usar última</span>
                    </span>
                    <span className={styles.hpHint}>
                      {lastJuntada.players.length} jug.
                      {lastJuntada.location ? ` · ${lastJuntada.location}` : ""}
                    </span>
                  </button>
                )}
              </div>
            )}

            <div className={styles.scoreList}>
              {players.map((p, i) => (
                <ScoreRow
                  key={i}
                  player={p}
                  mode={mode}
                  position={positions[i]}
                  leader={
                    i === leaderIndex || (mode === "equipos" && playerWins(p))
                  }
                  isYou={i === youIndex}
                  userMap={userMap}
                  activeTeams={activeTeams}
                  canRemove={players.length > 1}
                  onScore={(v) => updateScore(i, v)}
                  onStep={(d) => stepScore(i, d)}
                  onTeam={(t) => setPlayerTeam(i, t)}
                  onToggleWin={() => {
                    setWinsManual(true);
                    updatePlayer(i, "win", !p.win);
                  }}
                  onRemove={() => removePlayer(i)}
                />
              ))}
            </div>

            {/* El picker se DESPLIEGA como popover (no empuja el contenido),
                igual que el de ubicación. */}
            <div className={styles.addPlayerArea} ref={addAreaRef}>
              <div className={styles.addPlayerLabel}>Agregar jugadores</div>
              <div className={styles.playerActions}>
                <button
                  type="button"
                  className={styles.addGuestBtn}
                  onClick={() => setAdding((a) => !a)}
                  aria-expanded={adding}
                >
                  <UserPlusIcon /> Agregar jugador
                </button>
                <button
                  type="button"
                  className={styles.addGuestBtn}
                  onClick={addAnonymous}
                >
                  <PlusIcon /> Anónimo
                </button>
                {canSortByScore && (
                  <button
                    type="button"
                    className={`${styles.btnGhost} ${styles.btnSmall} ${styles.pushRight}`}
                    onClick={sortByScore}
                    aria-label="Ordenar por puntaje"
                    title="Ordenar por puntaje"
                  >
                    <SortDescIcon />
                    {/* En mobile queda solo el ícono (texto oculto por CSS). */}
                    <span className={styles.sortText}>Ordenar por puntaje</span>
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
              <span className={styles.sectionTitle}>
                ¿Cuándo y dónde?
                <InfoTooltip placement="bottom" label="Ayuda: ¿Cuándo y dónde?">
                  Poné la <strong>fecha</strong> (no puede ser futura) y, si
                  querés, la <strong>duración</strong> y el{" "}
                  <strong>lugar</strong>. También podés marcar si quedó
                  incompleta o si no debe contar para las estadísticas.
                </InfoTooltip>
              </span>
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
                <div className={styles.durationWrap}>
                  <input
                    type="number"
                    min={0}
                    className={styles.input}
                    value={details.length}
                    onChange={(e) => updateDetail("length", e.target.value)}
                    placeholder="60"
                  />
                  {/* Sugerencia "tiempo de caja" como ícono DENTRO del input
                      (no agranda el alto del campo). */}
                  {suggestedDuration && details.length === "" && (
                    <button
                      type="button"
                      className={styles.durationSuggest}
                      onClick={() =>
                        updateDetail("length", String(suggestedDuration))
                      }
                      aria-label={`Usar tiempo de caja: ${suggestedDuration} min`}
                      title={`Usar tiempo de caja: ${suggestedDuration} min`}
                    >
                      <BoxTimeIcon />
                    </button>
                  )}
                </div>
                <div className={styles.quickRow}>
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.quick} ${Number(details.length) === m ? styles.quickActive : ""} ${m === 120 ? styles.quickXl : ""}`}
                      onClick={() => updateDetail("length", String(m))}
                    >
                      {m}min
                    </button>
                  ))}
                </div>
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
              <span className={styles.sectionTitle}>
                Notas
                <InfoTooltip placement="bottom" label="Ayuda: Notas">
                  Un comentario libre de la partida: la jugada que la definió,
                  la revancha pendiente, lo que quieras. Es{" "}
                  <strong>opcional</strong>.
                </InfoTooltip>
              </span>
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

          {/* 5 · Compartí esta partida (opcional, solo al crear) — la tarjeta
              entera es clicable y se despliega con un slide. */}
          {!editMode && (
            <section
              className={`${styles.section} ${styles.shareSection} ${
                shareEnabled ? styles.shareSectionOpen : ""
              }`}
            >
              <button
                type="button"
                className={styles.shareHead}
                onClick={() => setShareEnabled((v) => !v)}
                aria-expanded={shareEnabled}
              >
                <span
                  className={`${styles.sectionNum} ${styles.sectionNumOptional}`}
                >
                  5
                </span>
                <span className={styles.shareHeadText}>
                  <span className={styles.shareHeadTitle}>
                    Compartí esta partida
                  </span>
                  <span className={styles.shareHeadSub}>
                    Publicá una juntada con fotos y copiá el link para tus
                    grupos de WhatsApp o Telegram.
                  </span>
                </span>
                <span className={styles.sectionHint}>opcional</span>
                <svg
                  className={styles.shareChevron}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {/* En mobile el chevron se reemplaza por un switch (handoff
                    phone 4); es decorativo — el botón entero togglea. */}
                <span
                  className={`${styles.shareToggle} ${shareEnabled ? styles.shareToggleOn : ""}`}
                  aria-hidden="true"
                />
              </button>

              <div
                className={`${styles.shareCollapse} ${
                  shareEnabled ? styles.shareCollapseOpen : ""
                }`}
              >
                <div className={styles.shareCollapseInner}>
                  <div className={styles.shareBody}>
                    <CommunitySelect
                      value={shareValue.community}
                      onChange={(c) =>
                        setShareValue((v) => ({ ...v, community: c }))
                      }
                    />
                    <JuntadaFields
                      value={shareValue}
                      onChange={setShareValue}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {serverError && <div className={styles.errorBox}>{serverError}</div>}

          {/* En mobile este footer se vuelve la save bar sticky del handoff
              (fixed abajo, "Cancelar" como botón cuadrado con ícono). */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={handleCancelClick}
              disabled={submitting}
              aria-label="Cancelar"
            >
              <span className={styles.cancelIcon}>
                <TrashIcon />
              </span>
              <span className={styles.cancelText}>Cancelar</span>
            </button>
            <div className={styles.footerRight}>
              {allowMultiSave && !editMode && (
                <button
                  type="button"
                  className={`${styles.btnGhost} ${styles.multiSaveBtn}`}
                  onClick={() => submit(true)}
                  disabled={!canSubmit || submitting}
                  aria-label="Guardar y cargar otra"
                  title="Guardar y cargar otra"
                >
                  {/* En mobile queda solo el ícono (texto oculto por CSS). */}
                  <span className={styles.multiSaveIcon}>
                    <SaveAnotherIcon />
                  </span>
                  <span className={styles.multiSaveText}>
                    Guardar y cargar otra
                  </span>
                </button>
              )}
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={!canSubmit || submitting}
              >
                {!submitting && <CheckIcon />}
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
          <div className={styles.previewLabel}>
            <Meeple /> Tu entrada · en vivo
            {/* En mobile la preview queda ARRIBA del form y puede parecer
                interactiva — el ⓘ aclara que es solo la vista previa. En
                desktop (columna lateral) se oculta por CSS. */}
            <span className={styles.previewInfo}>
              <InfoTooltip placement="bottom" label="Ayuda: Vista previa">
                Esta tarjeta es solo la <strong>vista previa</strong> de tu
                partida: se va armando sola con lo que cargás en el formulario
                de abajo. Acá no hay nada para tocar.
              </InfoTooltip>
            </span>
          </div>
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
