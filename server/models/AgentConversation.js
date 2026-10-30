const mongoose = require("mongoose");

// Historial de una conversación con un agente de IA. El historial vive en el
// servidor (el cliente solo manda el mensaje nuevo + el id), así el cliente no
// puede inyectar turnos falsos del asistente ni resultados de tools.
//
// Las conversaciones son descartables: cada carga de partida es una nueva y
// el TTL las borra solas a las 24 h.

const STATUSES = ["active", "draft_created", "limit_reached", "error"];

const agentConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    agent: { type: String, enum: ["playLogger"], required: true },
    // Mensajes en el formato de la Messages API de Anthropic
    // ({ role, content }), tal cual se reenvían en cada llamada.
    messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Cantidad de mensajes que mandó el usuario (para el tope por conversación).
    userTurns: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: "active" },
    // Último borrador validado que devolvió create_play_draft.
    draft: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

agentConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const AgentConversation = mongoose.model(
  "AgentConversation",
  agentConversationSchema,
);
AgentConversation.STATUSES = STATUSES;

module.exports = AgentConversation;
