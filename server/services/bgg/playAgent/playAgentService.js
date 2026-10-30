// Orquesta un mensaje al agente de carga de partidas: valida, aplica cuotas,
// carga/crea la conversación, corre el bucle y persiste historial + uso.
// La ruta (routes/bggAgent.js) es solo plumbing HTTP sobre esto.

const AgentConversation = require("../../../models/AgentConversation");
const AgentUsage = require("../../../models/AgentUsage");
const httpError = require("../../../utils/httpError");
const logger = require("../../../utils/logger");
const { runPlayAgent } = require("./runAgent");
const { costUsd } = require("./pricing");

// Cuotas acordadas para el piloto.
const DAILY_CONVERSATIONS = 10; // cargas (conversaciones nuevas) por usuario cada 24 h
const MAX_USER_TURNS = 6; // mensajes del usuario por conversación
const MAX_MESSAGE_LENGTH = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let cachedClient = null;
let testClient = null;
// Solo para tests: reemplaza el cliente de Anthropic por uno falso (null lo quita).
function __setClientForTests(client) {
  testClient = client;
}
function getDefaultClient() {
  if (testClient) return testClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cachedClient) {
    const sdk = require("@anthropic-ai/sdk");
    const Anthropic = sdk.default || sdk.Anthropic || sdk;
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

// "Hoy" en la zona del usuario (YYYY-MM-DD). Por defecto Argentina.
function todayIn(timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Solo dejamos pasar del formulario lo que el agente puede usar, acotado.
function sanitizeFormContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  if (raw.game?.id && /^\d+$/.test(String(raw.game.id))) {
    out.game = { id: String(raw.game.id), name: String(raw.game.name || "").slice(0, 160) };
  }
  if (typeof raw.playdate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.playdate)) {
    out.playdate = raw.playdate;
  }
  if (Array.isArray(raw.players)) {
    const players = raw.players
      .slice(0, 12)
      .map((p) => ({
        name: String(p?.name || "").slice(0, 80),
        username: String(p?.username || "").slice(0, 60),
      }))
      .filter((p) => p.name || p.username);
    if (players.length) out.players = players;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {object} args
 * @param {object} args.user            usuario autenticado (req.user)
 * @param {string} [args.conversationId]
 * @param {string} args.message
 * @param {string} [args.locale]        "es" | "en"
 * @param {string} [args.timezone]
 * @param {object} [args.formContext]   lo ya cargado en el formulario (solo al empezar)
 * @param {Function} args.t             traductor (req.t)
 * @param {object} [args.client]        cliente de Anthropic (tests)
 */
async function handlePlayAgentMessage({
  user,
  conversationId,
  message,
  locale = "es",
  timezone = "America/Argentina/Buenos_Aires",
  formContext,
  t,
  client = getDefaultClient(),
}) {
  if (!user?.bggUsername) throw httpError(400, t("errors:playAgent.bggRequired"));

  const text = String(message || "").trim();
  if (!text) throw httpError(400, t("errors:playAgent.emptyMessage"));
  if (text.length > MAX_MESSAGE_LENGTH) throw httpError(400, t("errors:playAgent.messageTooLong"));

  if (!client) throw httpError(503, t("errors:playAgent.unavailable"));

  let conversation;
  if (conversationId) {
    conversation = await AgentConversation.findOne({
      _id: conversationId,
      userId: user._id,
      agent: "playLogger",
    });
    if (!conversation) throw httpError(404, t("errors:playAgent.conversationNotFound"));
    if (conversation.status !== "active" && conversation.status !== "draft_created") {
      throw httpError(409, t("errors:playAgent.conversationClosed"));
    }
    if (conversation.userTurns >= MAX_USER_TURNS) {
      throw httpError(429, t("errors:playAgent.turnLimit"));
    }
  } else {
    const since = new Date(Date.now() - DAY_MS);
    const used = await AgentConversation.countDocuments({
      userId: user._id,
      agent: "playLogger",
      createdAt: { $gte: since },
    });
    if (used >= DAILY_CONVERSATIONS) {
      throw httpError(429, t("errors:playAgent.dailyLimit", { count: DAILY_CONVERSATIONS }));
    }
    conversation = await AgentConversation.create({ userId: user._id, agent: "playLogger" });
  }

  const ownerBggUsername = user.bggUsername;
  const ctx = {
    bggUsername: ownerBggUsername.toLowerCase(),
    ownerBggUsername,
    ownerName: user.displayName || user.username || ownerBggUsername,
    today: todayIn(timezone),
    timezone,
    locale: locale === "en" ? "en" : "es",
    formContext: conversation.messages.length === 0 ? sanitizeFormContext(formContext) : null,
  };

  const messages = [...conversation.messages];
  const usageDocs = [];
  const onUsage = (model, usage = {}) => {
    usageDocs.push({
      userId: user._id,
      agent: "playLogger",
      conversationId: conversation._id,
      model,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0,
      costUsd: costUsd(model, usage),
    });
  };

  let result;
  try {
    result = await runPlayAgent({ client, messages, userText: text, ctx, onUsage });
  } catch (err) {
    logger.error("[playAgent] run failed", { error: err.message, status: err.status });
    // Una conversación nueva que falló en el primer mensaje no consume cuota.
    if (conversation.messages.length === 0) {
      await AgentConversation.deleteOne({ _id: conversation._id }).catch(() => {});
    } else {
      conversation.status = "error";
      await conversation.save().catch(() => {});
    }
    throw httpError(502, t("errors:playAgent.failed"));
  } finally {
    if (usageDocs.length) {
      await AgentUsage.insertMany(usageDocs).catch((e) =>
        logger.warn("[playAgent] usage insert failed", { error: e.message }),
      );
    }
  }

  conversation.messages = messages;
  conversation.markModified("messages");
  conversation.userTurns += 1;
  conversation.status = result.status;
  if (result.draft) {
    conversation.draft = { ...result.draft, warnings: result.warnings };
    conversation.markModified("draft");
  }
  await conversation.save();

  return {
    conversationId: String(conversation._id),
    reply: result.reply,
    draft: result.draft,
    warnings: result.warnings,
    status: result.status,
    turnsLeft: Math.max(0, MAX_USER_TURNS - conversation.userTurns),
  };
}

module.exports = {
  handlePlayAgentMessage,
  __setClientForTests,
  sanitizeFormContext,
  todayIn,
  DAILY_CONVERSATIONS,
  MAX_USER_TURNS,
  MAX_MESSAGE_LENGTH,
};
