// Bucle del agente de carga de partidas: modelo → tools → modelo, hasta que el
// modelo responda sin pedir tools o se alcance el tope de vueltas.
//
// No toca Mongo ni la red directamente: recibe el cliente de Anthropic, los
// handlers de las tools y un callback `onUsage` por inyección. Así se testea
// con un cliente falso y el servicio que persiste vive en otro lado.

const { TOOLS } = require("./tools");
const { SYSTEM_PROMPT, buildContextBlock } = require("./prompt");
const { HANDLERS } = require("./toolHandlers");

const DEFAULT_MODEL = process.env.PLAY_AGENT_MODEL || "claude-haiku-5-5";
const FALLBACK_MODEL = process.env.PLAY_AGENT_FALLBACK_MODEL || "claude-sonnet-5-5";
const MAX_ITERATIONS = 8;
const MAX_TOKENS = 800;

// System prompt y tools marcados para prompt caching: son idénticos en todas
// las llamadas, así que se leen de caché (mucho más barato) desde la segunda.
const SYSTEM = [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];
const CACHED_TOOLS = TOOLS.map((t, i) =>
  i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
);

function textOf(content = []) {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Errores del modelo/API que vale la pena reintentar con el modelo de respaldo
// (sobrecarga, rate limit, 5xx). Un 4xx de request mal armado no.
function isRetryable(err) {
  const status = err?.status;
  return !status || status === 429 || status === 529 || status >= 500;
}

async function callModel(client, params, onUsage) {
  try {
    const res = await client.messages.create({ ...params, model: DEFAULT_MODEL });
    await onUsage?.(DEFAULT_MODEL, res.usage);
    return res;
  } catch (err) {
    if (!isRetryable(err) || FALLBACK_MODEL === DEFAULT_MODEL) throw err;
    const res = await client.messages.create({ ...params, model: FALLBACK_MODEL });
    await onUsage?.(FALLBACK_MODEL, res.usage);
    return res;
  }
}

async function runTool(block, ctx, handlers) {
  const handler = handlers[block.name];
  if (!handler) {
    return { result: { error: `unknown tool ${block.name}` }, isError: true };
  }
  try {
    const result = await handler(block.input || {}, ctx);
    const isError = !!result?.error || result?.ok === false;
    return { result, isError };
  } catch (err) {
    return { result: { error: "tool failed, try again or ask the user" }, isError: true, err };
  }
}

/**
 * Procesa UN mensaje del usuario.
 *
 * @param {object} args
 * @param {object} args.client      cliente de Anthropic ({ messages.create })
 * @param {Array}  args.messages    historial previo (se muta: se agregan los turnos nuevos)
 * @param {string} args.userText    mensaje nuevo del usuario
 * @param {object} args.ctx         { bggUsername, ownerBggUsername, ownerName, today, timezone, locale, formContext }
 * @param {Function} [args.onUsage] (model, usage) => void, una vez por llamada al modelo
 * @param {object} [args.handlers]  tools (default: las reales)
 * @returns {Promise<{ reply: string, draft: object|null, warnings: string[], status: string }>}
 */
async function runPlayAgent({ client, messages, userText, ctx, onUsage, handlers = HANDLERS }) {
  // El contexto variable (fecha, idioma, dueño) va solo en el primer mensaje,
  // para no romper la caché del system prompt.
  const content =
    messages.length === 0 ? `${buildContextBlock(ctx)}\n\n${userText}` : userText;
  messages.push({ role: "user", content });

  let draft = null;
  let warnings = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await callModel(
      client,
      { max_tokens: MAX_TOKENS, system: SYSTEM, tools: CACHED_TOOLS, messages },
      onUsage,
    );
    messages.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      return {
        reply: textOf(res.content),
        draft,
        warnings,
        status: draft ? "draft_created" : "active",
      };
    }

    // Las tools pedidas en una misma respuesta se ejecutan en paralelo.
    const outcomes = await Promise.all(toolUses.map((b) => runTool(b, ctx, handlers)));
    const results = toolUses.map((block, idx) => {
      const { result, isError } = outcomes[idx];
      if (block.name === "create_play_draft" && result?.ok) {
        draft = result.draft;
        warnings = result.warnings || [];
      }
      return {
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        ...(isError ? { is_error: true } : {}),
      };
    });
    messages.push({ role: "user", content: results });
  }

  // Tope de vueltas: devolvemos lo que haya (si ya se creó el borrador, sirve).
  return { reply: "", draft, warnings, status: draft ? "draft_created" : "limit_reached" };
}

module.exports = {
  runPlayAgent,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  MAX_ITERATIONS,
  MAX_TOKENS,
};
