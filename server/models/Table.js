const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    boardGame: {
      type: String,
      required: [true, "Board game name is required"],
      trim: true,
      maxlength: [100, "Game name cannot exceed 100 characters"],
    },
    bggId: { type: Number, default: null },
    bggThumbnail: { type: String, default: null },
    bggImage: { type: String, default: null },
    bggYear: { type: Number, default: null },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    maxPlayers: {
      type: Number,
      required: [true, "Max players quantity is required"],
      min: [1, "Must allow at least 1 additional player"],
      max: [20, "Cannot exceed 20 additional players"],
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Migrado de String a subdocumento en 2026-05 para soportar cálculo
    // de distancias. Docs viejos que aún tienen `location: "texto"` se
    // normalizan al hidratar vía `pre('init')` hook abajo — no hace falta
    // script de migración (lazy upgrade en cada read).
    location: {
      texto: {
        type: String,
        trim: true,
        maxlength: [200, "Location cannot exceed 200 characters"],
        default: "",
      },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    rules: {
      type: String,
      trim: true,
      maxlength: [500, "Rules cannot exceed 500 characters"],
      default: "",
    },
    tags: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: [30, "Tag cannot exceed 30 characters"],
        },
      ],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: "Cannot have more than 5 tags",
      },
    },
    status: {
      type: String,
      enum: ["open", "full", "cancelled"],
      default: "open",
    },
    privacy: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
    },
    // Modo de la sección "Andá preparado" en TableDetail.
    //   - "none":   no muestra la sección.
    //   - "auto":   muestra los 3 primeros resultados de YouTube para
    //               "Como se juega <boardGame>" (comportamiento original
    //               de la feature). Es el default del schema para preservar
    //               el comportamiento de mesas creadas antes de este campo.
    //   - "manual": muestra un solo video propuesto por el host
    //               (tutorialVideoId).
    tutorialMode: {
      type: String,
      enum: ["none", "auto", "manual"],
      default: "auto",
    },
    // ID de YouTube (11 chars, [A-Za-z0-9_-]). Sólo se usa cuando
    // tutorialMode === "manual". El modelo lo guarda sin URL (lo
    // reconstruye el cliente al renderizar).
    tutorialVideoId: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || /^[A-Za-z0-9_-]{11}$/.test(v),
        message: "tutorialVideoId inválido",
      },
    },
    // URL opcional a la página del juego en boardgamearena.com. Si está
    // presente, TableDetail muestra la sección "Probá el juego online".
    bgaUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v) =>
          v === null ||
          /^https?:\/\/(www\.)?boardgamearena\.com\/.*/i.test(v),
        message: "El link debe ser de boardgamearena.com",
      },
    },
    pendingRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        uploader: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // Scoping al evento — null = mesa global (visible en /mesas); ObjectId =
    // mesa "del evento" (sólo visible dentro del detalle del evento, NUNCA
    // en el listado global). El listado global filtra `eventoId: null`. El
    // detalle (TableDetail) funciona igual sin importar el scope; cambia solo
    // dónde se lista y quién puede crearla.
    eventoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evento",
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// Indexes — el listado /api/tables filtra por status (excluye 'cancelled')
// y ordena por date. /api/tables/mine consulta por host. El "spot opened"
// notifier resuelve por players. Sin estos, full collection scans.
tableSchema.index({ status: 1, date: 1 });
tableSchema.index({ host: 1 });
tableSchema.index({ players: 1 });

// Virtual: total seats (host + maxPlayers)
tableSchema.virtual("totalPlayers").get(function () {
  return this.maxPlayers + 1;
});

// Virtual: available seats
tableSchema.virtual("availableSeats").get(function () {
  return this.maxPlayers - this.players.length;
});

// Lazy migration: normaliza `location` viejo (string plano) al nuevo shape.
// Corre solo al hidratar docs existentes — los nuevos ya nacen con la forma
// correcta. Sin esto, queries sobre tables viejas tirarían CastError porque
// Mongoose espera el subdoc.
tableSchema.pre("init", (doc) => {
  if (typeof doc.location === "string") {
    doc.location = { texto: doc.location, lat: null, lng: null };
  }
});

// Auto-update status based on player count
tableSchema.pre("save", function (next) {
  if (this.players.length >= this.maxPlayers) {
    this.status = "full";
  } else if (this.status === "full") {
    this.status = "open";
  }
  next();
});

module.exports = mongoose.model("Table", tableSchema);
