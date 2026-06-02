// ── Registro único de modelos scopeados por comunidad ───────────────────
//
// Fuente única de verdad de TODOS los modelos que llevan el campo `community`
// (vía el plugin `communityScoped`). Lo consumen los lugares que iteran "todo
// el contenido scopeado":
//   - el seed/backfill (`scripts/seed-base-community.js`)
//   - `reassignContentToBase` + la cascada de `deleteCommunity`
//   - el test-guardrail (`tests/integration/communityScoping.test.js`)
//
// Agregar un tipo de contenido scopeado nuevo = UNA línea acá (+ aplicar el
// plugin en su modelo). Todo lo transversal lo levanta solo. Ver plan §7.1.

const Table = require("../models/Table");
const Compartida = require("../models/Compartida");
const Evento = require("../models/Evento");
const Torneo = require("../models/Torneo");
const Noticia = require("../models/Noticia");
const MathTrade = require("../models/MathTrade");

// `model`: el modelo Mongoose. `label`: nombre legible para logs/tests.
const SCOPED_MODELS = [
  { model: Table, label: "Mesas" },
  { model: Compartida, label: "Compartidas" },
  { model: Evento, label: "Eventos" },
  { model: Torneo, label: "Torneos" },
  { model: Noticia, label: "Noticias" },
  { model: MathTrade, label: "Math Trades" },
];

module.exports = SCOPED_MODELS;
module.exports.SCOPED_MODELS = SCOPED_MODELS;
