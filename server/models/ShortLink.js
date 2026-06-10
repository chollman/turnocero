const mongoose = require("mongoose");
const crypto = require("crypto");

// Short link: un puntero global y opaco hacia un recurso compartible. El
// código (p.ej. "Ab3xK9") resuelve a un path canónico (`/compartidas/<id>`,
// `/eventos/<id>`, `/noticias/<id>`, `/bg-watch/<usuario>`,
// `/bg-watch/<usuario>/partidas/<playId>`) que el visitante alcanza por
// `/s/<code>`.
//
// NO usa el plugin `communityScoped`: un short link es un puntero global, la
// visibilidad la gobierna el recurso apuntado. El origin (incluido el
// subdominio de comunidad) lo preserva el cliente al armar `<origin>/s/<code>`,
// y el redirect es a un path relativo.

const TYPES = ["compartida", "evento", "noticia", "bgwatch", "partida"];

// 62 símbolos URL-safe sin ambigüedad de separadores. El sesgo de módulo
// (256 % 62) es despreciable para la longitud/cardinalidad que usamos.
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomCode(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % 62];
  return out;
}

const shortLinkSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^[A-Za-z0-9]+$/,
    },
    type: {
      type: String,
      required: true,
      enum: TYPES,
    },
    // ObjectId hex (compartida/evento/noticia), bggUsername (bgwatch) o
    // "<bggUsername>/<playId>" (partida).
    ref: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Un único código por recurso → compartir el mismo recurso N veces reusa el
// código (el route hace get-or-create contra este par).
shortLinkSchema.index({ type: 1, ref: 1 }, { unique: true });

// Genera un código único. 7 chars base62 ≈ 3.5e12 combinaciones; el retry-on
// -collision espeja `Community.generateSlug`.
shortLinkSchema.statics.generateCode = async function generateCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(7);
    if (!(await this.exists({ code }))) return code;
  }
  // Prácticamente inalcanzable: ensanchar para garantizar terminación.
  for (let i = 0; i < 10000; i++) {
    const code = randomCode(8);
    if (!(await this.exists({ code }))) return code;
  }
  return randomCode(12);
};

shortLinkSchema.methods.toJSON = function () {
  return {
    code: this.code,
    type: this.type,
    ref: this.ref,
    clicks: this.clicks,
    createdAt: this.createdAt,
  };
};

shortLinkSchema.statics.TYPES = TYPES;

module.exports = mongoose.model("ShortLink", shortLinkSchema);
