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
// `COMMUNITY_REQUIRED`: queda en `false` durante la migración (Fase 0/1) para
// que los docs viejos (sin comunidad) hidraten sin romper. Se flipa a `true`
// en la Fase 3, una vez que el default server-side garantiza que todo doc nuevo
// nace con comunidad — así cualquier code-path futuro que olvide setearla falla
// ruidoso (ValidationError) en vez de crear contenido sin scope que leakea.
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
