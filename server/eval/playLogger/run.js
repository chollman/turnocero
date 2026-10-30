#!/usr/bin/env node
// Evaluación del agente de carga de partidas (BG Watch).
//
// Corre los casos de cases.js contra el modelo REAL, con tools que leen datos
// fijos (fixtures.js) en vez de Mongo/BGG, y compara cada borrador con el
// esperado. Llama a la API de Anthropic, así que cuesta (centavos de dólar por
// corrida con Haiku): no forma parte de `npm test` ni del CI.
//
// Uso (desde server/):
//   npm run eval:agent                      # todos los casos
//   npm run eval:agent -- --only=equipos    # casos cuyo id contiene "equipos"
//   npm run eval:agent -- --dry             # valida los casos sin llamar a la API
//   PLAY_AGENT_MODEL=claude-sonnet-5-5 npm run eval:agent
//
// Requiere ANTHROPIC_API_KEY (salvo --dry). Sale con código 1 si la precisión
// queda por debajo del objetivo (90 %). Guarda el detalle en results/.

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { runPlayAgent, DEFAULT_MODEL } = require("../../services/bgg/playAgent/runAgent");
const { costUsd } = require("../../services/bgg/playAgent/pricing");
const { makeFixtureHandlers } = require("./fixtureHandlers");
const { judgeCase } = require("./compare");
const { expectedToToolInput } = require("./oracle");
const fx = require("./fixtures");
const CASES = require("./cases");

const TARGET = 0.9;
const CONCURRENCY = 3;

function parseArgs(argv) {
  const args = { dry: false, only: null };
  for (const a of argv) {
    if (a === "--dry") args.dry = true;
    else if (a.startsWith("--only=")) args.only = a.slice(7);
  }
  return args;
}

function makeCtx(testCase) {
  return {
    bggUsername: fx.OWNER.username,
    ownerBggUsername: fx.OWNER.username,
    ownerName: fx.OWNER.name,
    today: fx.TODAY,
    timezone: "America/Argentina/Buenos_Aires",
    locale: testCase.lang === "en" ? "en" : "es",
    formContext: null,
  };
}

function pickChoice(pendingAsk, userText) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  const option = pendingAsk?.question?.options?.find((o) => norm(o.label) === norm(userText));
  return option ? option.value : null;
}

async function runCase(client, testCase) {
  const handlers = makeFixtureHandlers();
  const messages = [];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, calls: 0 };
  const onUsage = (model, u = {}) => {
    usage.calls += 1;
    usage.input += u.input_tokens || 0;
    usage.output += u.output_tokens || 0;
    usage.cacheRead += u.cache_read_input_tokens || 0;
    usage.cacheWrite += u.cache_creation_input_tokens || 0;
    usage.cost += costUsd(model, u);
  };

  const turns = [];
  let error = null;
  let pendingAsk = null;
  try {
    for (const userText of testCase.turns) {
      // Si hay una pregunta con botones y el mensaje coincide con una opción,
      // se simula el toque del botón (choice); si no, es "Otro" (texto libre).
      const choice = pickChoice(pendingAsk, userText);
      const res = await runPlayAgent({
        client,
        messages,
        userText,
        ctx: makeCtx(testCase),
        onUsage,
        handlers,
        pendingAsk,
        choice,
      });
      pendingAsk = res.pendingAsk || null;
      turns.push({
        user: userText,
        choice,
        reply: res.reply,
        question: res.question,
        status: res.status,
        draft: res.draft,
        warnings: res.warnings,
      });
      if (res.draft || testCase.expect.kind === "noDraft") break;
    }
  } catch (err) {
    error = `${err.status || ""} ${err.message}`.trim();
  }

  const verdict = error
    ? { ok: false, diffs: [`error: ${error}`] }
    : judgeCase(testCase, { firstTurn: turns[0], final: turns.at(-1) });
  return { id: testCase.id, ...verdict, userTurns: turns.length, turns, usage };
}

// --dry: pasa el borrador esperado por las mismas tools (como lo haría un
// agente perfecto) y verifica que coincide consigo mismo.
async function dryRun(cases) {
  const handlers = makeFixtureHandlers();
  let bad = 0;
  for (const c of cases) {
    if (c.expect.kind !== "draft") {
      console.log(`  ·  ${c.id} (espera pregunta)`);
      continue;
    }
    const result = await handlers.create_play_draft(expectedToToolInput(c.expect.draft));
    const verdict = result.ok
      ? judgeCase(c, { firstTurn: { draft: result.draft }, final: { draft: result.draft } })
      : { ok: false, diffs: result.errors };
    if (!verdict.ok) bad += 1;
    console.log(`  ${verdict.ok ? "✓" : "✗"}  ${c.id}${verdict.ok ? "" : `\n       ${verdict.diffs.join("\n       ")}`}`);
  }
  console.log(`\n${cases.length - bad}/${cases.length} casos consistentes`);
  return bad === 0;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      process.stdout.write(out[i].ok ? "✓" : "✗");
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");
  return out;
}

function money(n) {
  return `USD ${n.toFixed(4)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = args.only ? CASES.filter((c) => c.id.includes(args.only)) : CASES;
  if (!cases.length) {
    console.error(`No hay casos que coincidan con "${args.only}".`);
    process.exit(2);
  }

  if (args.dry) {
    console.log(`Validando ${cases.length} casos sin llamar a la API…\n`);
    process.exit((await dryRun(cases)) ? 0 : 1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY (en server/.env o en el entorno). Usá --dry para validar los casos sin la API.");
    process.exit(2);
  }
  const sdk = require("@anthropic-ai/sdk");
  const Anthropic = sdk.default || sdk.Anthropic || sdk;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`Corriendo ${cases.length} casos con ${DEFAULT_MODEL}…`);
  const results = await pool(cases, CONCURRENCY, (c) => runCase(client, c));

  const passed = results.filter((r) => r.ok).length;
  const accuracy = passed / results.length;
  const totals = results.reduce(
    (acc, r) => {
      acc.cost += r.usage.cost;
      acc.input += r.usage.input + r.usage.cacheRead + r.usage.cacheWrite;
      acc.output += r.usage.output;
      acc.calls += r.usage.calls;
      acc.userTurns += r.userTurns;
      return acc;
    },
    { cost: 0, input: 0, output: 0, calls: 0, userTurns: 0 },
  );

  for (const r of results.filter((x) => !x.ok)) {
    console.log(`\n✗ ${r.id}`);
    for (const d of r.diffs) console.log(`    - ${d}`);
    const last = r.turns.at(-1);
    if (last?.reply) console.log(`    respuesta: ${last.reply.replace(/\s+/g, " ").slice(0, 200)}`);
  }

  const n = results.length;
  console.log("\n── Resumen ─────────────────────────────────────");
  console.log(`Precisión:            ${passed}/${n} (${(accuracy * 100).toFixed(1)} %) — objetivo ${TARGET * 100} %`);
  console.log(`Mensajes por caso:    ${(totals.userTurns / n).toFixed(2)}`);
  console.log(`Llamadas al modelo:   ${(totals.calls / n).toFixed(2)} por caso`);
  console.log(`Tokens por caso:      ${Math.round(totals.input / n)} entrada / ${Math.round(totals.output / n)} salida`);
  console.log(`Costo:                ${money(totals.cost / n)} por caso, ${money(totals.cost)} en total`);

  const dir = path.join(__dirname, "results");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ model: DEFAULT_MODEL, date: new Date().toISOString(), accuracy, totals, results }, null, 2),
  );
  console.log(`Detalle:              ${path.relative(process.cwd(), file)}`);

  process.exit(accuracy >= TARGET ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}

module.exports = { runCase, dryRun, parseArgs };
