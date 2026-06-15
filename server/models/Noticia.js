const mongoose = require("mongoose");
const communityScoped = require("./plugins/communityScoped");

// Categorías editoriales. Dirigen las tabs de la portada y el color del kicker
// en el cliente (mapa key→color en client/src/utils/noticiaCategories.js).
const NOTICIA_CATEGORIES = [
  "general",
  "comunidad",
  "resena",
  "evento",
  "producto",
  "envivo",
];

const noticiaSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 200 },
    // `body` ahora guarda HTML enriquecido (sanitizado al guardar). Las noticias
    // viejas tienen texto plano: el cliente lo renderiza partiendo por \n\n.
    body: { type: String, trim: true, maxlength: 40000 },
    // Bajada / excerpt — resumen corto bajo el titular y descripción OG.
    dek: { type: String, trim: true, maxlength: 320 },
    // Etiqueta editorial libre (default = label de la categoría en el cliente).
    kicker: { type: String, trim: true, maxlength: 60 },
    category: {
      type: String,
      enum: NOTICIA_CATEGORIES,
      default: "general",
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 32 }],
      default: [],
    },
    link: { type: String, trim: true, maxlength: 500 },
    linkLabel: { type: String, trim: true, maxlength: 80 },
    image: {
      url: { type: String },
      publicId: { type: String },
      caption: { type: String, trim: true, maxlength: 200 },
    },
    // Cita destacada (breakout) opcional.
    quote: {
      text: { type: String, trim: true, maxlength: 400 },
      author: { type: String, trim: true, maxlength: 80 },
      context: { type: String, trim: true, maxlength: 80 },
    },
    // Jerarquía de la portada (controlada por admin).
    featured: { type: Boolean, default: false },
    isBrief: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    // Se setea la primera vez que pasa a `published`. El feed ordena por
    // publishedAt ?? createdAt.
    publishedAt: { type: Date },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Scoping por comunidad: campo `community` + índice { community, createdAt }.
noticiaSchema.plugin(communityScoped, { indexes: [{ createdAt: -1 }] });

const Noticia = mongoose.model("Noticia", noticiaSchema);
Noticia.CATEGORIES = NOTICIA_CATEGORIES;

module.exports = Noticia;
