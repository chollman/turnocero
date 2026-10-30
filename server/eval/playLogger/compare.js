// Compara el borrador que armó el agente contra el esperado de un caso.
// Puro: devuelve { ok, diffs } con una línea legible por cada diferencia.
// Ver la cabecera de cases.js para la semántica de cada campo.

const { normalizeForSearch: norm } = require("../../services/bgg/bggUserGames");

function playerKey(p) {
  const u = String(p.username || "").trim().toLowerCase();
  return u ? `u:${u}` : `n:${norm(p.name)}`;
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Equipos: lo que importa es quién está con quién, no la letra. Se arma un
// mapeo letra esperada → letra real y tiene que ser consistente y biyectivo.
function compareTeams(expectedPlayers, actualByKey, diffs) {
  const map = new Map();
  const used = new Map();
  for (const exp of expectedPlayers) {
    if (!exp.team) continue;
    const act = actualByKey.get(playerKey(exp));
    if (!act) continue;
    const real = act.team || "";
    if (!real) {
      diffs.push(`${playerKey(exp)}: expected a team, got none`);
      continue;
    }
    if (map.has(exp.team) && map.get(exp.team) !== real) {
      diffs.push(`${playerKey(exp)}: should be on the same team as other team ${exp.team} players`);
    } else if (used.has(real) && used.get(real) !== exp.team) {
      diffs.push(`${playerKey(exp)}: shares team ${real} with players of another expected team`);
    } else {
      map.set(exp.team, real);
      used.set(real, exp.team);
    }
  }
}

function compareDraft(expected = {}, draft) {
  const diffs = [];
  if (!draft) return { ok: false, diffs: ["no draft was created"] };

  const eq = (label, exp, act) => {
    if (exp === undefined) return;
    if (String(exp) !== String(act ?? "")) diffs.push(`${label}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
  };
  const contains = (label, exp, act) => {
    if (exp === undefined) return;
    if (!norm(act).includes(norm(exp))) diffs.push(`${label}: expected to contain ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
  };

  eq("gameId", expected.gameId, draft.game?.id);
  eq("playdate", expected.playdate, draft.details?.playdate);
  eq("mode", expected.mode, draft.mode);
  eq("coopResult", expected.coopResult, draft.coopResult);
  if (expected.length !== undefined) eq("length", expected.length, draft.details?.length);
  contains("variant", expected.variant, draft.variant);
  contains("location", expected.location, draft.details?.location);
  contains("notes", expected.notesIncludes, draft.details?.comments);

  if (expected.expansions) {
    const exp = [...expected.expansions].map(String).sort();
    const act = (draft.expansions || []).map((e) => String(e.id)).sort();
    if (JSON.stringify(exp) !== JSON.stringify(act)) {
      diffs.push(`expansions: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
    }
  }

  if (expected.players) {
    const actual = draft.players || [];
    const actualByKey = new Map(actual.map((p) => [playerKey(p), p]));
    const expKeys = expected.players.map(playerKey).sort();
    const actKeys = [...actualByKey.keys()].sort();
    if (JSON.stringify(expKeys) !== JSON.stringify(actKeys) || actual.length !== actualByKey.size) {
      diffs.push(`players: expected ${JSON.stringify(expKeys)}, got ${JSON.stringify(actual.map(playerKey))}`);
    }
    for (const exp of expected.players) {
      const key = playerKey(exp);
      const act = actualByKey.get(key);
      if (!act) continue;
      if (exp.score !== undefined && toNum(exp.score) !== toNum(act.score)) {
        diffs.push(`${key}.score: expected ${exp.score}, got ${JSON.stringify(act.score)}`);
      }
      if (exp.win !== undefined && !!exp.win !== !!act.win) {
        diffs.push(`${key}.win: expected ${exp.win}, got ${!!act.win}`);
      }
      if (exp.faction !== undefined && norm(exp.faction) !== norm(act.faction)) {
        diffs.push(`${key}.faction: expected ${JSON.stringify(exp.faction)}, got ${JSON.stringify(act.faction)}`);
      }
    }
    compareTeams(expected.players, actualByKey, diffs);
  }

  return { ok: diffs.length === 0, diffs };
}

// Resultado de un caso completo a partir de lo que pasó en la conversación.
// `firstTurn` = resultado del primer mensaje; `final` = del último.
function judgeCase(testCase, { firstTurn, final }) {
  if (testCase.expect.kind === "noDraft") {
    if (firstTurn?.draft) {
      return { ok: false, diffs: ["expected the agent to ask instead of creating a draft"] };
    }
    // askKind: la pregunta tiene que venir con botones (ask_user) de ese tipo.
    const askKind = testCase.expect.askKind;
    if (askKind && firstTurn?.question?.kind !== askKind) {
      const got = firstTurn?.question ? firstTurn.question.kind : "a plain-text question";
      return { ok: false, diffs: [`expected an ask_user question of kind "${askKind}", got ${got}`] };
    }
    if (askKind && (firstTurn.question.options || []).length < 2) {
      return { ok: false, diffs: ["expected at least two options in the question"] };
    }
    return { ok: true, diffs: [] };
  }
  return compareDraft(testCase.expect.draft, final?.draft);
}

module.exports = { compareDraft, judgeCase, playerKey };
