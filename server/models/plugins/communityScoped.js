const mongoose = require("mongoose");

// ── Plugin de Mongoose: scoping por comunidad ────────────────────────────
//
// `schema.plugin(communityScoped, { indexes: [...] })` agrega de forma
// consistente el campo `community` (ref a Community) + los índices compuestos
// recomendados, con `community` como clave líder para que `{ community: { $in } }`
// quede index-backed y el sort se mantenga utilizable.
//
// Definir el campo en UN solo lugar evita copy-paste divergente entre los ~6
// modelos de contenido. Ver plan §7.2.
//
// `COMMUNITY_REQUIRED`: se mantiene en `false`. La intención original (Fase 3)
// era flipearlo a `true` como guardrail "fail-loud", pero en la práctica obliga
// a CADA `Model.create` directo (model/service/job tests, fixtures, código
// futuro) a setear `community` — un impuesto de mantenimiento alto. La garantía
// real la dan: (1) `communityService.resolveCreateCommunity` en todas las rutas
// eslint-disable-next-line no-warning-comments
// de creación (todo contenido creado vía API nace con comunidad), y (2) el
// test-guardrail `communityScoping.test.js`, que recorre el registro y verifica
// que cada lista scopee. Ese par cubre el riesgo de leak sin el costo del flip.
const COMMUNITY_REQUIRED = false;

function communityScoped(schema, opts = {}) {
  schema.add({
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: COMMUNITY_REQUIRED,
    },
  });

  // Índices compuestos: `community` líder + las claves de sort/secundarias que
  // pasa cada modelo (ej. Table → { status, date }). Si un modelo no pasa
  // ninguno, cae al índice de campo simple. Cardinalidad de comunidades baja ⇒
  // la selectividad sale del sort, por eso compuesto y no solo single-field.
  const extras = Array.isArray(opts.indexes) ? opts.indexes : [];
  if (extras.length === 0) {
    schema.index({ community: 1 });
  } else {
    for (const extra of extras) {
      schema.index({ community: 1, ...extra });
    }
  }
}

module.exports = communityScoped;
module.exports.COMMUNITY_REQUIRED = COMMUNITY_REQUIRED;
