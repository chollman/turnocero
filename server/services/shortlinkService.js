// Lógica de short links extraída del router (patrón pareado con
// eventoService/torneoService): testeable aislada con mongodb-memory-server.
//
// - `pathFor(type, ref)` mapea un recurso a su path canónico.
// - `getOrCreate` valida que el recurso EXISTE y es público, y devuelve el
//   ShortLink reusándolo si ya hay uno para ese par (dedup por {type, ref}).
// - `resolve(code)` cuenta el click y devuelve el destino.

const ShortLink = require("../models/ShortLink");
const Compartida = require("../models/Compartida");
const Evento = require("../models/Evento");
const Noticia = require("../models/Noticia");
const httpError = require("../utils/httpError");

function pathFor(type, ref) {
  switch (type) {
    case "compartida":
      return `/compartidas/${ref}`;
    case "evento":
      return `/eventos/${ref}`;
    case "noticia":
      return `/noticias/${ref}`;
    case "bgwatch":
      return `/bg-watch/${ref}`;
    case "partida": {
      // ref = "<bggUsername>/<playId>" (ver assertShareable).
      const [user, playId] = String(ref).split("/");
      if (!user || !playId) return null;
      return `/bg-watch/${user}/partidas/${playId}`;
    }
    default:
      return null;
  }
}

// Verifica que el recurso apuntado exista y sea compartible públicamente.
// Lanza httpError(404) si no. Para bgwatch no hay documento (el perfil se
// deriva del bggUsername y las páginas son públicas) → solo se valida formato.
async function assertShareable(type, ref) {
  if (type === "compartida") {
    const doc = await Compartida.findById(ref).select("privacy");
    if (!doc || doc.privacy !== "public")
      throw httpError(404, "Compartida no encontrada");
    return;
  }
  if (type === "evento") {
    const doc = await Evento.findById(ref).select("status");
    if (!doc || !["open", "closed"].includes(doc.status))
      throw httpError(404, "Evento no encontrado");
    return;
  }
  if (type === "noticia") {
    const doc = await Noticia.findById(ref).select("_id");
    if (!doc) throw httpError(404, "Noticia no encontrada");
    return;
  }
  if (type === "bgwatch") {
    if (!ref || ref.length > 120)
      throw httpError(400, "Usuario de BGG inválido");
    return;
  }
  if (type === "partida") {
    // "<bggUsername>/<playId>" — igual que bgwatch, no hay documento propio
    // (las partidas pueden vivir solo en BGG, sin espejo en Mongo) → solo se
    // valida formato. La página destino resuelve/404ea por su cuenta.
    if (!ref || ref.length > 120 || !/^[^/]+\/\d+$/.test(ref))
      throw httpError(400, "Partida inválida");
    return;
  }
  throw httpError(400, "Tipo de recurso inválido");
}

// Get-or-create idempotente. Devuelve el ShortLink. Con dos requests
// concurrentes para el mismo recurso, el índice unique {type, ref} hace que el
// segundo insert tire E11000 → reintentamos el find.
async function getOrCreate({ type, ref, createdBy = null }) {
  if (!ShortLink.TYPES.includes(type))
    throw httpError(400, "Tipo de recurso inválido");
  if (!ref) throw httpError(400, "Falta el recurso");

  let link = await ShortLink.findOne({ type, ref });
  if (link) return link;

  await assertShareable(type, ref);

  const code = await ShortLink.generateCode();
  try {
    link = await ShortLink.create({ type, ref, code, createdBy });
  } catch (err) {
    // Carrera: otro request creó el mismo {type, ref} entremedio.
    if (err.code === 11000) {
      link = await ShortLink.findOne({ type, ref });
      if (link) return link;
    }
    throw err;
  }
  return link;
}

// Resuelve un código a su destino y cuenta el click. Devuelve null si no existe.
async function resolve(code) {
  const link = await ShortLink.findOneAndUpdate(
    { code },
    { $inc: { clicks: 1 } },
    { new: true },
  );
  if (!link) return null;
  return { type: link.type, ref: link.ref, path: pathFor(link.type, link.ref) };
}

module.exports = { pathFor, assertShareable, getOrCreate, resolve };
