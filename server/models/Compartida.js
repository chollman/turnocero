const mongoose = require("mongoose");
const communityScoped = require("./plugins/communityScoped");

// Límites de largo del body según la categoría: las juntadas guardan texto
// plano corto; las reseñas guardan HTML enriquecido (sanitizado) y necesitan
// mucho más margen.
const BODY_MAX = { juntada: 2000, resena: 20000 };

// Snapshot denormalizado del juego de BGG (mismo criterio que
// `linkedTable.bggThumbnail`): evita un populate/roundtrip a BGG para
// renderizar el header del juego en el feed.
const boardGameSnapshotSchema = new mongoose.Schema(
  {
    bggId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    thumbnail: { type: String, default: "" },
    image: { type: String, default: "" },
    year: { type: Number, default: null },
  },
  { _id: false },
);

const compartidaSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // "juntada" = post social de fotos/relato (diseño polaroid).
    // "resena" = reseña editorial de un juego (HTML enriquecido + rating).
    // Default "juntada" → los docs viejos (sin campo) se leen como juntada,
    // sin migración rompedora.
    category: {
      type: String,
      enum: ["resena", "juntada"],
      default: "juntada",
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "El título no puede superar 100 caracteres"],
      default: "",
    },
    body: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator(v) {
          const cap = BODY_MAX[this.category] ?? BODY_MAX.juntada;
          return (v || "").length <= cap;
        },
        message: "El texto supera el largo permitido",
      },
    },
    // Reseña: 1 juego obligatorio (snapshot único).
    boardGame: {
      type: boardGameSnapshotSchema,
      default: null,
    },
    // Juntada: lista de juegos jugados (0..N). Las reseñas no la usan.
    boardGames: {
      type: [boardGameSnapshotSchema],
      default: [],
    },
    // Puntuación 1–10, solo para reseñas (null en juntadas).
    rating: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    linkedTable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      default: null,
    },
    linkedEvento: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evento",
      default: null,
    },
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// Defensa en profundidad: la validación primaria vive en la ruta, pero este
// hook garantiza que ningún factory/script pueda crear una reseña inválida.
compartidaSchema.pre("validate", function enforceCategoryShape(next) {
  if (this.category === "resena") {
    if (!this.boardGame || !this.boardGame.bggId) {
      return next(new Error("La reseña necesita un juego"));
    }
    if (
      typeof this.rating !== "number" ||
      this.rating < 1 ||
      this.rating > 10
    ) {
      return next(new Error("La reseña necesita una puntuación de 1 a 10"));
    }
  } else {
    // Juntada nunca lleva rating.
    this.rating = null;
  }
  next();
});

// Scoping por comunidad: campo `community` + índices para el feed y por categoría.
compartidaSchema.plugin(communityScoped, {
  indexes: [{ createdAt: -1 }, { category: 1, createdAt: -1 }],
});

module.exports = mongoose.model("Compartida", compartidaSchema);
module.exports.BODY_MAX = BODY_MAX;
