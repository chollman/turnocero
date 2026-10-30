const mongoose = require("mongoose");

// Una fila por llamada al modelo hecha por un agente de IA (hoy, solo el
// agente de carga de partidas de BG Watch). Guarda los tokens que reporta la
// API en `usage` y el costo estimado en USD, para poder responder "¿cuánto
// cuesta cada carga?" y detectar abusos o loops. El resultado de la
// conversación (borrador creado, abandonada, etc.) vive en AgentConversation.
//
// TTL de 180 días: alcanza para analizar tendencias sin acumular para siempre.

const AGENT_KINDS = ["playLogger"];

const agentUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agent: { type: String, enum: AGENT_KINDS, required: true },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentConversation",
      default: null,
    },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
  },
  { timestamps: true },
);

agentUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 });
agentUsageSchema.index({ userId: 1, createdAt: -1 });

const AgentUsage = mongoose.model("AgentUsage", agentUsageSchema);
AgentUsage.AGENT_KINDS = AGENT_KINDS;

module.exports = AgentUsage;
